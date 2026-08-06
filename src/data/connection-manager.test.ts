import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Candle, ConnectionStatus, SourceId, Symbol } from '@/types/domain';
import type { DataSource, ConnectResult } from '@/data/source';

function mockCandle(time: number): Candle {
  return { time, open: 100, high: 110, low: 90, close: 105, volume: 1000 };
}

function makeSource(id: SourceId, connectFn: () => Promise<ConnectResult>): DataSource {
  return {
    id,
    connect: () => connectFn(),
    disconnect: () => {},
    fetchHistory: () => Promise.resolve([mockCandle(0)]),
    fetchServerTime: () => Promise.resolve(Date.now()),
    onTick: () => () => {},
    onCandle: () => () => {},
    onStatus: (cb) => { cb('live'); return () => {}; },
  };
}

const cryptoSymbol: Symbol = {
  id: 'BTCUSDT',
  assetClass: 'crypto',
  sourceMap: { crypto: ['binance', 'deriv'], forex: [] },
  displaySymbol: 'BTC/USDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  displayName: 'Bitcoin',
  pipSize: 0.01,
  marketHours: null,
};

const forexSymbol: Symbol = {
  id: 'EURUSD',
  assetClass: 'forex',
  sourceMap: { crypto: [], forex: ['deriv', 'twelvedata'] },
  displaySymbol: 'EUR/USD',
  baseAsset: 'EUR',
  quoteAsset: 'USD',
  displayName: 'Euro',
  pipSize: 0.00001,
  marketHours: null,
};

describe('ConnectionManager failover', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('falls over to the next source when the first fails', async () => {
    let binanceCalls = 0;
    let derivCalls = 0;
    const failing = makeSource('binance', () => Promise.reject(new Error('WS down')));
    const okResult: ConnectResult = {
      candles: [mockCandle(1), mockCandle(2)],
      source: 'deriv',
    };
    const working = makeSource('deriv', () => Promise.resolve(okResult));

    vi.doMock('@/data/factory', () => ({
      createSource: (id: SourceId) => {
        if (id === 'binance') { binanceCalls++; return failing; }
        derivCalls++;
        return working;
      },
    }));

    const { ConnectionManager } = await import('@/data/connection-manager');
    const mgr = new ConnectionManager();

    const result = await mgr.connectAndGetHistory(cryptoSymbol, '15m');
    expect(result.status).toBe('live');
    expect(result.source).toBe('deriv');
    expect(result.candles).toHaveLength(2);
    expect(binanceCalls).toBe(3);
    expect(derivCalls).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('returns failed status when all sources fail', async () => {
    const fail1 = makeSource('deriv', () => Promise.reject(new Error('down')));
    const fail2 = makeSource('twelvedata', () => Promise.reject(new Error('down')));

    vi.doMock('@/data/factory', () => ({
      createSource: (id: SourceId) => id === 'deriv' ? fail1 : fail2,
    }));

    const { ConnectionManager } = await import('@/data/connection-manager');
    const mgr = new ConnectionManager();

    const result = await mgr.connectAndGetHistory(forexSymbol, '15m');
    expect(result.status).toBe('failed');
    expect(result.candles).toEqual([]);
  }, 15000);

  it('exposes activeSource via public getter', async () => {
    const okResult: ConnectResult = {
      candles: [mockCandle(0)],
      source: 'binance',
    };
    const ok = makeSource('binance', () => Promise.resolve(okResult));

    vi.doMock('@/data/factory', () => ({
      createSource: () => ok,
    }));

    const { ConnectionManager } = await import('@/data/connection-manager');
    const mgr = new ConnectionManager();
    expect(mgr.activeSource).toBeNull();

    await mgr.connectAndGetHistory(cryptoSymbol, '15m');
    expect(mgr.activeSource).toBe('binance');
    mgr.disconnect();
    expect(mgr.activeSource).toBeNull();
  });

  it('propagates connection statuses to listeners', async () => {
    const okResult: ConnectResult = {
      candles: [mockCandle(0)],
      source: 'binance',
    };
    const ok = makeSource('binance', () => Promise.resolve(okResult));

    vi.doMock('@/data/factory', () => ({
      createSource: () => ok,
    }));

    const { ConnectionManager } = await import('@/data/connection-manager');
    const mgr = new ConnectionManager();
    const statuses: ConnectionStatus[] = [];
    mgr.onStatus((s) => statuses.push(s));

    await mgr.connectAndGetHistory(cryptoSymbol, '15m');
    mgr.disconnect();

    const statusSet = new Set(statuses);
    expect(statusSet.has('connecting')).toBe(true);
    expect(statusSet.has('live')).toBe(true);
    expect(statusSet.has('idle')).toBe(true);
  });
});
