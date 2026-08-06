import type { Candle, Tick, Timeframe, ConnectionStatus, SourceId } from '@/types/domain';
import type { DataSource, ConnectResult } from '../source';
import { normalizeServerTime } from '../source';
import { serverClock } from '../server-clock';
import { mapSymbolForDeriv } from '../symbols';
import { PROVIDERS_CONFIG, buildDerivWsUrl } from '../providers.config';
import { captureError } from '@/lib/sentry';

type StatusListener = (status: ConnectionStatus) => void;
type TickListener = (tick: Tick) => void;
type CandleListener = (candle: Candle, isClosed: boolean) => void;

interface PendingReq {
  resolve: (data: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v);
  return NaN;
}

export class DerivSource implements DataSource {
  readonly id: SourceId = 'deriv';

  private ws: WebSocket | null = null;
  private activeSymbol: string | null = null;
  private activeTimeframe: Timeframe | null = null;
  private statusListeners = new Set<StatusListener>();
  private tickListeners = new Set<TickListener>();
  private candleListeners = new Set<CandleListener>();
  private pending = new Map<string, PendingReq>();
  private reqSeq = 0;
  private status: ConnectionStatus = 'idle';
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  async connect(symbolId: string, timeframe: Timeframe): Promise<ConnectResult> {
    const cfg = PROVIDERS_CONFIG.deriv;
    const granularity = cfg.granularityMap[timeframe];
    if (!granularity) throw new Error(`Deriv: unsupported timeframe ${timeframe}`);

    this.disconnect();
    this.activeSymbol = symbolId;
    this.activeTimeframe = timeframe;
    this.reconnectCount = 0;
    this.setStatus('connecting');
    await this.ensureSocket();
    const derivSymbol = mapSymbolForDeriv(symbolId);
    const candles = await this.fetchHistory(symbolId, timeframe, cfg.defaultHistory);
    this.subscribeStreams(derivSymbol);
    this.startPing();
    this.setStatus('live');
    return { candles, source: this.id };
  }

  disconnect(): void {
    this.activeSymbol = null;
    this.activeTimeframe = null;
    this.reconnectCount = 0;
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
      this.ws = null;
    }
    this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('Disconnected')); });
    this.pending.clear();
    this.setStatus('idle');
  }

  async fetchHistory(symbolId: string, timeframe: Timeframe, count: number): Promise<Candle[]> {
    const cfg = PROVIDERS_CONFIG.deriv;
    const granularity = cfg.granularityMap[timeframe];
    if (!granularity) throw new Error(`Deriv: unsupported timeframe ${timeframe}`);
    const derivSymbol = mapSymbolForDeriv(symbolId);
    const resp = await this.send({
      ticks_history: derivSymbol, end: 'latest', style: 'candles', granularity, count,
    });
    const candlesRaw = resp.candles as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(candlesRaw)) throw new Error('Deriv: unexpected history shape');
    return candlesRaw.map((c) => ({
      time: safeNum(c.epoch),
      open: safeNum(c.open),
      high: safeNum(c.high),
      low: safeNum(c.low),
      close: safeNum(c.close),
      volume: 0,
    }));
  }

  async fetchServerTime(): Promise<number> {
    const resp = await this.send({ time: 1 });
    return normalizeServerTime(safeNum(resp.time));
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

  private ensureSocket(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error('Socket lost'));
        const existing = this.ws;
        const onOpen = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('Deriv WS connection failed')); };
        const onClose = () => { cleanup(); reject(new Error('Deriv WS closed before open')); };
        const cleanup = () => {
          existing.removeEventListener('open', onOpen);
          existing.removeEventListener('error', onError);
          existing.removeEventListener('close', onClose);
        };
        existing.addEventListener('open', onOpen, { once: true });
        existing.addEventListener('error', onError, { once: true });
        existing.addEventListener('close', onClose, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(buildDerivWsUrl());
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Deriv WS connection failed'));
      ws.onclose = () => {
        this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('Deriv WS closed')); });
        this.pending.clear();
        if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
        if (this.activeSymbol !== null) this.scheduleReconnect();
      };
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') this.handleMessage(e.data);
      };
    });
  }

  private send(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Deriv: socket not open'));
    }
    const reqId = ++this.reqSeq;
    const key = String(reqId);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(key)) {
          this.pending.delete(key);
          reject(new Error('Deriv: request timeout'));
        }
      }, PROVIDERS_CONFIG.deriv.requestTimeoutMs);
      this.pending.set(key, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ ...payload, req_id: reqId }));
    });
  }

  private subscribeStreams(derivSymbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ ticks: derivSymbol, subscribe: 1 }));
    const granularity = PROVIDERS_CONFIG.deriv.granularityMap[this.activeTimeframe ?? '1m'];
    if (granularity) {
      this.ws.send(JSON.stringify({ ohlc: derivSymbol, subscribe: 1, granularity }));
    }
  }

  private startPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    const cfg = PROVIDERS_CONFIG.deriv;
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, cfg.pingIntervalMs);
  }

  private scheduleReconnect(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    const cfg = PROVIDERS_CONFIG.deriv;
    const maxReconnect = cfg.reconnectBackoffMs.length;
    if (this.reconnectCount >= maxReconnect) {
      this.setStatus('failed');
      return;
    }
    const idx = Math.min(this.reconnectCount, cfg.reconnectBackoffMs.length - 1);
    const delay = cfg.reconnectBackoffMs[idx];
    this.reconnectCount++;
    this.setStatus('reconnecting');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.activeSymbol || !this.activeTimeframe) return;
      void this.ensureSocket().then(() => {
        const derivSymbol = mapSymbolForDeriv(this.activeSymbol!);
        this.subscribeStreams(derivSymbol);
        this.startPing();
        this.reconnectCount = 0;
        this.setStatus('live');
      }).catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  private handleMessage(raw: string): void {
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return; }
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, unknown>;

    const reqId = typeof msg.req_id === 'number' ? String(msg.req_id)
      : typeof msg.req_id === 'string' ? msg.req_id : undefined;
    if (reqId && this.pending.has(reqId)) {
      const pending = this.pending.get(reqId)!;
      this.pending.delete(reqId);
      clearTimeout(pending.timer);
      if (msg.error) {
        const errObj = msg.error as Record<string, unknown>;
        const errMsg = errObj.message;
        pending.reject(new Error(typeof errMsg === 'string' ? errMsg : 'Deriv error'));
      } else {
        pending.resolve(msg);
      }
      return;
    }

    if (msg.error && !reqId) {
      const errObj = msg.error as Record<string, unknown>;
      const errMsg = typeof errObj.message === 'string' ? errObj.message : 'Deriv subscription error';
      captureError(new Error(`Deriv stream error: ${errMsg}`), { level: 'warning' });
      return;
    }

    if (msg.tick) {
      const tick = msg.tick as Record<string, unknown>;
      const t: Tick = { price: safeNum(tick.quote), time: safeNum(tick.epoch) };
      this.emit(this.tickListeners, t);
    }

    if (msg.ohlc) {
      const ohlc = msg.ohlc as Record<string, unknown>;
      const tfSec = PROVIDERS_CONFIG.deriv.granularityMap[this.activeTimeframe ?? '1m'] ?? 60;
      const openTime = safeNum(ohlc.open_time);
      const candle: Candle = {
        time: openTime,
        open: safeNum(ohlc.open),
        high: safeNum(ohlc.high),
        low: safeNum(ohlc.low),
        close: safeNum(ohlc.close),
        volume: 0,
      };
      const now = Math.floor(serverClock.now() / 1000);
      const isClosed = now >= openTime + tfSec;
      this.emit(this.candleListeners, candle, isClosed);
    }
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.emit(this.statusListeners, s);
  }

  private emit<T extends (...args: never[]) => void>(listeners: Set<T>, ...args: Parameters<T>): void {
    listeners.forEach((l) => {
      try { l(...args); } catch { /* isolate listener errors */ }
    });
  }
}
