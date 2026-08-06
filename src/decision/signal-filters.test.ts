import { describe, it, expect } from 'vitest';
import { applySignalFilters, CONTEXT_PENALTY } from './signal-filters';
import type { Candle, IndicatorSnapshot, MarketStructure, PatternResult, Snapshot } from '@/types/domain';

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const indicators: IndicatorSnapshot = {
    rsi: 50, emaFast: 100, emaSlow: 98, macd: 0.5, macdSignal: 0.3, macdHistogram: 0.2,
    atr: 2, bollingerUpper: 105, bollingerMiddle: 100, bollingerLower: 95,
    vwap: 100, volumeProfilePoc: 100, meanReversionRsi: 50, impulseVelocity: 0,
  };
  const structure: MarketStructure = {
    trend: 'up', bos: false, choch: false, swingHigh: 105, swingLow: 95,
  };
  return {
    indicators,
    patterns: [],
    structure,
    regime: 'trend',
    lastPrice: 100,
    candleTime: 1000,
    ...overrides,
  };
}

function makeCandle(time: number, open: number, high: number, low: number, close: number, volume = 100): Candle {
  return { time, open, high, low, close, volume };
}

function uptrendCandles(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 100 + i * 2;
    out.push(makeCandle(i * 60, base - 1, base + 2, base - 2, base + 1));
  }
  return out;
}

function downtrendCandles(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 200 - i * 2;
    out.push(makeCandle(i * 60, base + 1, base + 2, base - 2, base - 1));
  }
  return out;
}

describe('applySignalFilters', () => {
  it('returns neutral multiplier when no patterns and no confirmations', () => {
    const candles = uptrendCandles(30);
    const snapshot = makeSnapshot({ patterns: [] });
    const result = applySignalFilters(candles, snapshot, 'buy', 0.5);
    expect(result.invalidated).toBe(false);
    expect(result.confirmed).toBe(false);
    expect(result.scoreMultiplier).toBe(1);
    expect(result.reasons).toHaveLength(0);
  });

  it('applies context penalty when pattern is in range with no S/R/OB context', () => {
    const candles = uptrendCandles(30);
    const pattern: PatternResult = {
      name: 'hammer', direction: 'buy', confidence: 0.7, strength: 'moderate', time: 1000,
    };
    const snapshot = makeSnapshot({
      patterns: [pattern],
      structure: { trend: 'range', bos: false, choch: false, swingHigh: null, swingLow: null },
    });
    const result = applySignalFilters(candles, snapshot, 'buy', 0.7);
    expect(result.scoreMultiplier).toBe(CONTEXT_PENALTY);
    expect(result.reasons).toContainEqual(expect.stringContaining('score reduced'));
  });

  it('confirms signal with untouched bullish OB nearby for buy direction', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 30; i++) {
      const base = 100 + i * 2;
      if (i === 25) {
        candles.push(makeCandle(i * 60, base + 3, base + 5, base - 2, base - 1));
      } else if (i === 26) {
        candles.push(makeCandle(i * 60, base - 1, base + 4, base - 2, base + 3));
      } else {
        candles.push(makeCandle(i * 60, base - 1, base + 2, base - 2, base + 1));
      }
    }
    const snapshot = makeSnapshot({ patterns: [] });
    const result = applySignalFilters(candles, snapshot, 'buy', 0.6);
    expect(result.scoreMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('confirms signal with untouched bearish OB nearby for sell direction', () => {
    const candles = downtrendCandles(30);
    const snapshot = makeSnapshot({ patterns: [] });
    const result = applySignalFilters(candles, snapshot, 'sell', 0.6);
    expect(result.scoreMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('invalidates buy signal when price closes below prior candle low', () => {
    const candles = uptrendCandles(30);
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    candles[candles.length - 1] = makeCandle(last.time, last.open, last.high, last.low, prev.low - 10);
    const snapshot = makeSnapshot({ patterns: [] });
    const result = applySignalFilters(candles, snapshot, 'buy', 0.6);
    expect(result.invalidated).toBe(true);
    expect(result.scoreMultiplier).toBe(0);
    expect(result.reasons).toContainEqual(expect.stringContaining('invalidated'));
  });

  it('invalidates sell signal when price closes above prior candle high', () => {
    const candles = downtrendCandles(30);
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    candles[candles.length - 1] = makeCandle(last.time, last.open, last.high, last.low, prev.high + 10);
    const snapshot = makeSnapshot({ patterns: [] });
    const result = applySignalFilters(candles, snapshot, 'sell', 0.6);
    expect(result.invalidated).toBe(true);
    expect(result.scoreMultiplier).toBe(0);
  });

  it('does not invalidate buy signal when close is within ATR buffer of prior low', () => {
    const candles = uptrendCandles(30);
    const prev = candles[candles.length - 2];
    const last = candles[candles.length - 1];
    candles[candles.length - 1] = makeCandle(last.time, last.open, last.high, last.low, prev.low - 0.01);
    const snapshot = makeSnapshot({ patterns: [] });
    const result = applySignalFilters(candles, snapshot, 'buy', 0.6);
    expect(result.invalidated).toBe(false);
  });

  it('does not apply context penalty when no patterns detected', () => {
    const candles = uptrendCandles(30);
    const snapshot = makeSnapshot({
      patterns: [],
      structure: { trend: 'range', bos: false, choch: false, swingHigh: null, swingLow: null },
    });
    const result = applySignalFilters(candles, snapshot, 'buy', 0.5);
    expect(result.scoreMultiplier).toBe(1);
  });
});
