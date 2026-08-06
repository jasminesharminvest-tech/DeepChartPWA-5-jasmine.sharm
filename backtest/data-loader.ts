import type { Candle } from '@/types/domain';
import { isCrypto } from '@/data/symbols';

const BINANCE_REST = 'https://api.binance.com';
const DERIV_WS = 'wss://ws.derivws.com/websockets/v3?app_id=1089';
const MAX_PER_REQUEST = 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const DERIV_GRANULARITY = 60;

export interface LoadOptions {
  symbol: string;
  fromMs: number;
  toMs: number;
}

export async function loadHistory(options: LoadOptions): Promise<Candle[]> {
  const { symbol } = options;
  if (isCrypto(symbol)) {
    return loadBinanceHistory(options);
  }
  return loadDerivHistory(options);
}

async function loadBinanceHistory(options: LoadOptions): Promise<Candle[]> {
  const { symbol, fromMs, toMs } = options;
  const candles: Candle[] = [];
  let startTime = fromMs;

  while (startTime < toMs) {
    const batch = await fetchBinanceBatch(symbol, startTime, toMs);
    if (batch.length === 0) break;

    for (const c of batch) {
      if (c.time * 1000 <= toMs) candles.push(c);
    }

    if (batch.length < MAX_PER_REQUEST) break;
    startTime = batch[batch.length - 1].time * 1000 + 60_000;
  }

  return deduplicate(candles);
}

async function fetchBinanceBatch(symbol: string, startTime: number, endTime: number): Promise<Candle[]> {
  const url =
    `${BINANCE_REST}/api/v3/klines?symbol=${symbol}&interval=1m` +
    `&startTime=${startTime}&endTime=${endTime}&limit=${MAX_PER_REQUEST}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Binance API ${res.status} ${res.statusText}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Binance API: unexpected response shape');
    return rows.map(parseKlineRow);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Binance API: request timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseKlineRow(row: unknown): Candle {
  const r = row as (string | number)[];
  return {
    time: Math.floor(Number(r[0]) / 1000),
    open: parseFloat(String(r[1])),
    high: parseFloat(String(r[2])),
    low: parseFloat(String(r[3])),
    close: parseFloat(String(r[4])),
    volume: parseFloat(String(r[5])),
  };
}

async function loadDerivHistory(options: LoadOptions): Promise<Candle[]> {
  const { symbol, fromMs, toMs } = options;
  const allCandles: Candle[] = [];
  let endTime = Math.floor(toMs / 1000);
  const startSec = Math.floor(fromMs / 1000);

  while (endTime > startSec) {
    const batch = await fetchDerivBatch(symbol, endTime);
    if (batch.length === 0) break;

    const oldest = batch[0].time;
    for (const c of batch) {
      if (c.time >= startSec && c.time <= endTime) allCandles.push(c);
    }

    if (batch.length < MAX_PER_REQUEST) break;
    if (oldest <= startSec) break;
    endTime = oldest - 1;
  }

  return deduplicate(allCandles);
}

interface DerivPending {
  resolve: (data: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

async function fetchDerivBatch(symbol: string, endEpoch: number): Promise<Candle[]> {
  const derivSymbol = mapToDerivSymbol(symbol);
  return new Promise<Candle[]>((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS);
    const pending = new Map<string, DerivPending>();
    let settled = false;

    const cleanup = () => {
      pending.forEach((p) => { clearTimeout(p.timer); });
      pending.clear();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Deriv WS: request timeout'));
    }, REQUEST_TIMEOUT_MS);

    ws.onopen = () => {
      const reqId = 'bt1';
      pending.set(reqId, {
        resolve: (data) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          const candlesRaw = data.candles as Array<Record<string, unknown>> | undefined;
          if (!Array.isArray(candlesRaw)) {
            reject(new Error('Deriv: unexpected history shape'));
            return;
          }
          const candles = candlesRaw.map((c) => ({
            time: Number(c.epoch),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: 0,
          }));
          resolve(candles);
        },
        reject: (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });
      ws.send(JSON.stringify({
        ticks_history: derivSymbol,
        end: String(endEpoch),
        style: 'candles',
        granularity: DERIV_GRANULARITY,
        count: MAX_PER_REQUEST,
        req_id: reqId,
      }));
    };

    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let data: unknown;
      try { data = JSON.parse(e.data); } catch { return; }
      if (!data || typeof data !== 'object') return;
      const msg = data as Record<string, unknown>;
      const reqId = typeof msg.req_id === 'string' ? msg.req_id : undefined;
      if (reqId && pending.has(reqId)) {
        const p = pending.get(reqId)!;
        pending.delete(reqId);
        if (msg.error) {
          p.reject(new Error(String((msg.error as Record<string, unknown>).message ?? 'Deriv error')));
        } else {
          p.resolve(msg);
        }
      }
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Deriv WS: connection failed'));
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('Deriv WS: connection closed unexpectedly'));
      }
    };
  });
}

function mapToDerivSymbol(symbolId: string): string {
  if (symbolId.startsWith('frx:') || symbolId.startsWith('cry:')) return symbolId;
  return `frx:${symbolId}`;
}

function deduplicate(candles: Candle[]): Candle[] {
  const seen = new Set<number>();
  const result: Candle[] = [];
  for (const c of candles) {
    if (!seen.has(c.time)) {
      seen.add(c.time);
      result.push(c);
    }
  }
  return result.sort((a, b) => a.time - b.time);
}
