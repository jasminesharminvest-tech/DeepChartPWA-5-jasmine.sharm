import type { Candle, Tick, Timeframe, ConnectionStatus, SourceId } from '@/types/domain';
import type { DataSource, ConnectResult } from '../source';
import { normalizeServerTime } from '../source';
import { serverClock } from '../server-clock';
import { TIMEFRAME_SECONDS, mapSymbolForSource } from '@/data/symbols';
import { PROVIDERS_CONFIG } from '../providers.config';

const POLL_MS = 2500;

const TF_TO_INTERVAL: Partial<Record<Timeframe, string>> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '60m', '4h': '4h', '1d': '1d',
};

type StatusListener = (status: ConnectionStatus) => void;
type TickListener = (tick: Tick) => void;
type CandleListener = (candle: Candle, isClosed: boolean) => void;

interface YahooResult {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

export class YahooSource implements DataSource {
  readonly id: SourceId = 'yahoo';

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private activeSymbol: string | null = null;
  private activeTimeframe: Timeframe | null = null;
  private lastCandleTime = 0;
  private statusListeners = new Set<StatusListener>();
  private tickListeners = new Set<TickListener>();
  private candleListeners = new Set<CandleListener>();
  private status: ConnectionStatus = 'idle';

  private getProxy(): string {
    return import.meta.env.VITE_YAHOO_PROXY_URL ?? '';
  }

  async connect(symbolId: string, timeframe: Timeframe): Promise<ConnectResult> {
    this.disconnect();
    this.activeSymbol = symbolId;
    this.activeTimeframe = timeframe;
    this.setStatus('connecting');
    const candles = await this.fetchHistory(symbolId, timeframe, PROVIDERS_CONFIG.yahoo.defaultHistory);
    if (candles.length > 0) this.lastCandleTime = candles[candles.length - 1].time;
    this.startPolling(symbolId, timeframe);
    this.setStatus('live');
    return { candles, source: this.id };
  }

  disconnect(): void {
    this.activeSymbol = null;
    this.activeTimeframe = null;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.setStatus('idle');
  }

  async fetchHistory(symbolId: string, timeframe: Timeframe, count: number): Promise<Candle[]> {
    const interval = TF_TO_INTERVAL[timeframe];
    if (!interval) throw new Error(`Yahoo: unsupported timeframe ${timeframe}`);
    const proxy = this.getProxy();
    if (!proxy) throw new Error('Yahoo: VITE_YAHOO_PROXY_URL not configured');
    const tfSec = TIMEFRAME_SECONDS[timeframe];
    const range = yahooRange(count, tfSec);
    const mapped = mapSymbolForSource(symbolId, 'yahoo');
    const yahooSymbol = mapped.includes('=') ? mapped : `${mapped}=X`;
    const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
    const url = `${proxy}${encodeURIComponent(target)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROVIDERS_CONFIG.yahoo.requestTimeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') throw new Error('Yahoo: request timeout');
      throw err;
    }
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const data = (await res.json()) as YahooResult;
    if (data.chart?.error) throw new Error(`Yahoo: ${data.chart.error.description}`);
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp) throw new Error('Yahoo: no data');
    const q = result.indicators?.quote?.[0];
    if (!q) throw new Error('Yahoo: no quote data');
    return result.timestamp
      .map((time, i) => ({
        time,
        open: q.open?.[i] ?? NaN,
        high: q.high?.[i] ?? NaN,
        low: q.low?.[i] ?? NaN,
        close: q.close?.[i] ?? NaN,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter((c) => !Number.isNaN(c.close) && !Number.isNaN(c.open));
  }

  fetchServerTime(): Promise<number> {
    return Promise.resolve(normalizeServerTime(Math.floor(Date.now() / 1000)));
  }

  onTick(cb: TickListener): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  onCandle(cb: CandleListener): () => void {
    this.candleListeners.add(cb);
    return () => this.candleListeners.delete(cb);
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  private startPolling(symbolId: string, timeframe: Timeframe): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      void this.poll(symbolId, timeframe).catch(() => this.setStatus('degraded'));
    }, POLL_MS);
  }

  private async poll(symbolId: string, timeframe: Timeframe): Promise<void> {
    const tfSec = TIMEFRAME_SECONDS[timeframe];
    const candles = await this.fetchHistory(symbolId, timeframe, 2);
    const now = Math.floor(serverClock.now() / 1000);
    for (const c of candles) {
      if (c.time < this.lastCandleTime) continue;
      this.lastCandleTime = c.time;
      const isClosed = now >= c.time + tfSec;
      this.emit(this.candleListeners, c, isClosed);
    }
    const last = candles[candles.length - 1];
    if (last) {
      this.emit(this.tickListeners, { price: last.close, time: last.time } satisfies Tick);
    }
    this.setStatus('live');
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.emit(this.statusListeners, s);
  }

  private emit<T extends (...args: never[]) => void>(listeners: Set<T>, ...args: Parameters<T>): void {
    listeners.forEach((l) => { try { l(...args); } catch { /* isolate */ } });
  }
}

function yahooRange(count: number, tfSec: number): string {
  const totalSec = count * tfSec;
  const days = totalSec / 86400;
  if (days <= 1) return '1d';
  if (days <= 5) return '5d';
  if (days <= 30) return '1mo';
  if (days <= 90) return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 365) return '1y';
  return '2y';
}
