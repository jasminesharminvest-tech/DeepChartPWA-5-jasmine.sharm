import { describe, it, expect } from 'vitest';
import { computeDirectionScore, isPatternInRange } from '@/decision/direction-prediction';
import type { Candle, IndicatorSnapshot, MarketStructure, Snapshot, PatternResult } from '@/types/domain';

function makeCandles(count: number, trend: 'up' | 'down' | 'flat' = 'up'): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = trend === 'up' ? 0.5 : trend === 'down' ? -0.5 : 0;
    const close = open + change;
    const high = Math.max(open, close) + 0.2;
    const low = Math.min(open, close) - 0.2;
    candles.push({ time: 1700000000 + i * 60, open, high, low, close, volume: 1000 });
    price = close;
  }
  return candles;
}

function snapshotWith(overrides: Partial<Snapshot> = {}): Snapshot {
  const indicators: IndicatorSnapshot = {
    rsi: null, emaFast: null, emaSlow: null, macd: null, macdSignal: null,
    macdHistogram: null, atr: null, bollingerUpper: null, bollingerMiddle: null,
    bollingerLower: null, vwap: null, volumeProfilePoc: null,
    meanReversionRsi: null, impulseVelocity: null,
  };
  const structure: MarketStructure = {
    trend: 'range', bos: false, choch: false, swingHigh: null, swingLow: null,
  };
  return {
    indicators, structure, patterns: [], regime: 'range',
    lastPrice: null, candleTime: null, ...overrides,
  };
}

describe('computeDirectionScore — sell direction', () => {
  it('returns sell for downtrend with bearish structure', () => {
    const snapshot = snapshotWith({
      structure: { trend: 'down', bos: true, choch: false, swingHigh: 110, swingLow: 90 },
    });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.direction).toBe('sell');
    expect(result.score).toBeGreaterThan(0);
    expect(result.components.structure).toBeLessThan(0);
    expect(result.components.bos).toBeLessThan(0);
  });

  it('sell reasons contain bearish structure entries', () => {
    const snapshot = snapshotWith({
      structure: { trend: 'down', bos: true, choch: false, swingHigh: 110, swingLow: 90 },
    });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.reasons.some((r) => r.includes('bearish'))).toBe(true);
  });
});

describe('computeDirectionScore — CHoCH', () => {
  it('CHoCH bullish adds positive structure component', () => {
    const snapshot = snapshotWith({
      structure: { trend: 'up', bos: false, choch: true, swingHigh: 110, swingLow: 95 },
    });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(result.components.structure).toBe(0.5);
  });

  it('CHoCH bearish adds negative structure component', () => {
    const snapshot = snapshotWith({
      structure: { trend: 'down', bos: false, choch: true, swingHigh: 110, swingLow: 95 },
    });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.components.structure).toBe(-0.5);
  });
});

describe('computeDirectionScore — indicators', () => {
  it('EMA fast above slow adds positive indicator component', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, emaFast: 102, emaSlow: 100 },
    });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(result.components.indicator).toBeGreaterThan(0);
  });

  it('EMA fast below slow adds negative indicator component', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, emaFast: 98, emaSlow: 100 },
    });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.components.indicator).toBeLessThan(0);
  });

  it('RSI oversold adds positive indicator component', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, rsi: 25 },
    });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(result.components.indicator).toBeGreaterThan(0);
  });

  it('RSI overbought adds negative indicator component', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, rsi: 75 },
    });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.components.indicator).toBeLessThan(0);
  });

  it('indicator component is clamped to [-1, 1]', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, emaFast: 200, emaSlow: 100, rsi: 20 },
    });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(result.components.indicator).toBeLessThanOrEqual(1);
    expect(result.components.indicator).toBeGreaterThanOrEqual(-1);
  });
});

describe('computeDirectionScore — MACD', () => {
  it('positive MACD histogram adds positive macd component', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, macdHistogram: 0.5 },
    });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(result.components.macd).toBeGreaterThan(0);
  });

  it('negative MACD histogram adds negative macd component', () => {
    const snapshot = snapshotWith({
      indicators: { ...snapshotWith().indicators, macdHistogram: -0.5 },
    });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.components.macd).toBeLessThan(0);
  });
});

describe('computeDirectionScore — mean reversion', () => {
  it('price at lower Bollinger band adds positive meanReversion', () => {
    const candles = makeCandles(60, 'flat');
    const last = candles[candles.length - 1];
    const snapshot = snapshotWith({
      indicators: {
        ...snapshotWith().indicators,
        bollingerLower: last.close,
        bollingerMiddle: last.close + 5,
        bollingerUpper: last.close + 10,
      },
    });
    const result = computeDirectionScore(candles, snapshot);
    expect(result.components.meanReversion).toBe(0.5);
  });

  it('price at upper Bollinger band adds negative meanReversion', () => {
    const candles = makeCandles(60, 'flat');
    const last = candles[candles.length - 1];
    const snapshot = snapshotWith({
      indicators: {
        ...snapshotWith().indicators,
        bollingerLower: last.close - 10,
        bollingerMiddle: last.close - 5,
        bollingerUpper: last.close,
      },
    });
    const result = computeDirectionScore(candles, snapshot);
    expect(result.components.meanReversion).toBe(-0.5);
  });
});

describe('computeDirectionScore — trigger (patterns)', () => {
  it('bullish pattern adds positive trigger component', () => {
    const pattern: PatternResult = {
      name: 'hammer', direction: 'buy', confidence: 0.8, strength: 'strong', time: 1700000000,
    };
    const snapshot = snapshotWith({ patterns: [pattern] });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(result.components.trigger).toBe(0.8);
  });

  it('bearish pattern adds negative trigger component', () => {
    const pattern: PatternResult = {
      name: 'shooting-star', direction: 'sell', confidence: 0.7, strength: 'strong', time: 1700000000,
    };
    const snapshot = snapshotWith({ patterns: [pattern] });
    const result = computeDirectionScore(makeCandles(60, 'down'), snapshot);
    expect(result.components.trigger).toBe(-0.7);
  });
});

describe('computeDirectionScore — conflicting components', () => {
  it('bullish structure but bearish indicators produces a valid direction', () => {
    const snapshot = snapshotWith({
      structure: { trend: 'up', bos: true, choch: false, swingHigh: 110, swingLow: 95 },
      indicators: { ...snapshotWith().indicators, emaFast: 98, emaSlow: 100, rsi: 75 },
    });
    const result = computeDirectionScore(makeCandles(60, 'up'), snapshot);
    expect(['buy', 'sell']).toContain(result.direction);
  });
});

describe('computeDirectionScore — flat market', () => {
  it('returns a valid direction for flat market', () => {
    const snapshot = snapshotWith();
    const result = computeDirectionScore(makeCandles(60, 'flat'), snapshot);
    expect(['buy', 'sell']).toContain(result.direction);
  });

  it('flat market with no signals produces a valid direction', () => {
    const snapshot = snapshotWith();
    const result = computeDirectionScore(makeCandles(60, 'flat'), snapshot);
    expect(['buy', 'sell']).toContain(result.direction);
  });
});

describe('isPatternInRange', () => {
  it('returns true when price is far from S/R and OB zones', () => {
    const candles: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 60; i++) {
      const open = price;
      const close = open + 0.8;
      candles.push({
        time: 1700000000 + i * 60,
        open, high: close + 0.2, low: open - 0.2, close, volume: 1000,
      });
      price = close;
    }
    const snapshot = snapshotWith();
    const result = isPatternInRange(candles, snapshot);
    expect(result).toBe(true);
  });

  it('returns false for insufficient ATR', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 5; i++) {
      candles.push({ time: i * 60, open: 100, high: 100, low: 100, close: 100, volume: 0 });
    }
    const snapshot = snapshotWith();
    const result = isPatternInRange(candles, snapshot);
    expect(result).toBe(false);
  });
});
