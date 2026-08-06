import { describe, it, expect } from 'vitest';
import { sma, ema, StreamingEMA, StreamingSMA } from '@/compute/indicators/ema';
import { rsi } from '@/compute/indicators/rsi';
import { macd } from '@/compute/indicators/macd';
import { atr, trueRange } from '@/compute/indicators/atr';
import { bollinger } from '@/compute/indicators/bollinger';
import { vwap, vwapLast } from '@/compute/indicators/vwap';
import { volumeProfilePoc } from '@/compute/indicators/volume-profile';
import { computeImpulseVelocity } from '@/compute/indicators/impulse-velocity';
import { supportResistance } from '@/compute/indicators/support-resistance';
import { computeStructure } from '@/compute/indicators/trend-structure';
import { detectMarketRegime } from '@/compute/indicators/market-regime';
import { classifyVsa } from '@/compute/indicators/vsa-classifier';
import { orderBlockStrength } from '@/compute/indicators/order-block-strength';
import { fibonacciRetracement } from '@/compute/indicators/fibonacci';
import { liquidityPools } from '@/compute/indicators/liquidity-pools';
import { superOrderBlocks } from '@/compute/indicators/super-order-block';
import { computeIndicators } from '@/compute/IndicatorAggregator';
import { buildFullSnapshot } from '@/compute/full-snapshot';
import type { Candle, IndicatorConfig } from '@/types/domain';
import { performance } from 'node:perf_hooks';

function makeCandles(n: number, base: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = base + Math.sin(i / 3) * 5 + i * 0.2;
    return {
      time: i * 60,
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000,
    };
  });
}

describe('sma', () => {
  it('returns null until enough values', () => {
    const result = sma([1, 2], 3);
    expect(result).toEqual([null, null]);
  });

  it('computes correct averages', () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });
});

describe('ema', () => {
  it('seeds with SMA on period-th value', () => {
    const result = ema([1, 2, 3, 4], 3);
    expect(result[2]).toBeCloseTo(2);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
  });

  it('smooths subsequent values', () => {
    const result = ema([1, 2, 3, 4, 5], 3);
    expect(result[3]).not.toBeNull();
    expect(result[4]).not.toBeNull();
    expect(result[4]! > result[3]!).toBe(true);
  });
});

describe('rsi', () => {
  it('returns null for insufficient data', () => {
    expect(rsi([1, 2, 3], 14)).toEqual([null, null, null]);
  });

  it('returns 100 for purely rising series', () => {
    const rising = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = rsi(rising, 14);
    expect(result[14]).toBe(100);
  });

  it('returns 0 for purely falling series', () => {
    const falling = Array.from({ length: 20 }, (_, i) => 100 - i);
    const result = rsi(falling, 14);
    expect(result[14]).toBeCloseTo(0);
  });

  it('returns values between 0 and 100 for mixed series', () => {
    const mixed = [50, 52, 49, 51, 53, 50, 48, 51, 53, 55, 52, 50, 48, 51, 53, 55];
    const result = rsi(mixed, 14);
    expect(result[14]).not.toBeNull();
    expect(result[14]!).toBeGreaterThan(0);
    expect(result[14]!).toBeLessThan(100);
  });
});

describe('macd', () => {
  it('produces equal-length arrays', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const result = macd(closes, 12, 26, 9);
    expect(result.macd.length).toBe(closes.length);
    expect(result.signal.length).toBe(closes.length);
    expect(result.histogram.length).toBe(closes.length);
  });

  it('histogram equals macd minus signal', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const result = macd(closes, 12, 26, 9);
    for (let i = 0; i < closes.length; i++) {
      if (result.macd[i] !== null && result.signal[i] !== null) {
        expect(result.histogram[i]).toBeCloseTo(result.macd[i]! - result.signal[i]!);
      }
    }
  });

  it('signal line does not contaminate with zeros in warmup', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const result = macd(closes, 12, 26, 9);
    const firstSignalIdx = result.signal.findIndex((v) => v !== null);
    expect(firstSignalIdx).toBeGreaterThan(25);
  });
});

describe('trueRange', () => {
  it('first value is high minus low', () => {
    const candles = [
      { time: 0, open: 10, high: 15, low: 8, close: 12, volume: 100 },
    ];
    expect(trueRange(candles)).toEqual([7]);
  });

  it('accounts for previous close gap', () => {
    const candles = [
      { time: 0, open: 10, high: 15, low: 8, close: 12, volume: 100 },
      { time: 1, open: 20, high: 22, low: 19, close: 21, volume: 100 },
    ];
    const tr = trueRange(candles);
    expect(tr[1]).toBe(Math.max(22 - 19, Math.abs(22 - 12), Math.abs(19 - 12)));
  });
});

describe('atr', () => {
  it('returns null until period filled', () => {
    const candles = makeCandles(10, 100);
    const result = atr(candles, 14);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it('computes a positive value after warmup', () => {
    const candles = makeCandles(30, 100);
    const result = atr(candles, 14);
    expect(result[13]).not.toBeNull();
    expect(result[13]! > 0).toBe(true);
  });
});

describe('bollinger', () => {
  it('upper and lower bracket the middle', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const result = bollinger(closes, 20, 2);
    const i = 25;
    expect(result.middle[i]).not.toBeNull();
    expect(result.upper[i]! > result.middle[i]!).toBe(true);
    expect(result.lower[i]! < result.middle[i]!).toBe(true);
  });
});

describe('vwap', () => {
  it('returns null for zero-volume candles', () => {
    const candles = makeCandles(5, 100).map((c) => ({ ...c, volume: 0 }));
    expect(vwapLast(candles)).toBeNull();
  });

  it('computes cumulative VWAP', () => {
    const candles: Candle[] = [
      { time: 0, open: 10, high: 11, low: 9, close: 10, volume: 100 },
      { time: 1, open: 10, high: 12, low: 10, close: 11, volume: 200 },
    ];
    const result = vwap(candles);
    expect(result[1]).not.toBeNull();
    const expected = ((11 + 9 + 10) / 3 * 100 + (12 + 10 + 11) / 3 * 200) / 300;
    expect(result[1]).toBeCloseTo(expected, 5);
  });
});

describe('volumeProfile', () => {
  it('returns null POC for zero-volume candles', () => {
    const candles = makeCandles(20, 100).map((c) => ({ ...c, volume: 0 }));
    expect(volumeProfilePoc(candles)).toBeNull();
  });

  it('finds POC at highest-volume bin', () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: i === 15 ? 5000 : 100,
    }));
    const poc = volumeProfilePoc(candles, 50);
    expect(poc).not.toBeNull();
    expect(poc).toBeCloseTo(100, 0);
  });
});

describe('impulseVelocity', () => {
  it('returns null for insufficient candles', () => {
    expect(computeImpulseVelocity(makeCandles(5, 100))).toBeNull();
  });

  it('returns a positive ratio for trending candles', () => {
    const candles = makeCandles(30, 100);
    const result = computeImpulseVelocity(candles);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });
});

describe('supportResistance', () => {
  it('returns empty for insufficient candles', () => {
    expect(supportResistance(makeCandles(5, 100))).toHaveLength(0);
  });

  it('clusters fractal levels using ATR threshold', () => {
    const candles = makeCandles(50, 100);
    const levels = supportResistance(candles, 14);
    for (const level of levels) {
      expect(level.touches).toBeGreaterThanOrEqual(2);
      expect(level.strength).toBeGreaterThan(0);
    }
  });
});

describe('computeStructure', () => {
  it('returns range for insufficient candles', () => {
    const s = computeStructure(makeCandles(3, 100));
    expect(s.trend).toBe('range');
  });

  it('detects uptrend', () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: i,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 101 + i,
      volume: 100,
    }));
    const s = computeStructure(candles);
    expect(s.trend).toBe('up');
  });
});

describe('detectMarketRegime', () => {
  it('returns range for insufficient candles', () => {
    expect(detectMarketRegime(makeCandles(5, 100))).toBe('range');
  });

  it('detects trend in directional series', () => {
    const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
      time: i,
      open: 100 + i * 2,
      high: 103 + i * 2,
      low: 99 + i * 2,
      close: 102 + i * 2,
      volume: 100,
    }));
    expect(detectMarketRegime(candles)).toBe('trend');
  });
});

describe('classifyVsa', () => {
  it('returns neutral for insufficient data', () => {
    expect(classifyVsa(makeCandles(5, 100)).signal).toBe('neutral');
  });
});

describe('orderBlockStrength', () => {
  it('filters filled FVG zones', () => {
    const candles = makeCandles(50, 100);
    const zones = orderBlockStrength(candles);
    for (const z of zones) {
      expect(z.filled).toBe(false);
    }
  });
});

describe('fibonacciRetracement', () => {
  it('returns empty for insufficient candles', () => {
    expect(fibonacciRetracement(makeCandles(5, 100))).toHaveLength(0);
  });

  it('computes retracement levels', () => {
    const levels = fibonacciRetracement(makeCandles(50, 100));
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.some((l) => l.level === 0.618)).toBe(true);
  });
});

describe('liquidityPools', () => {
  it('returns empty for insufficient candles', () => {
    expect(liquidityPools(makeCandles(3, 100))).toHaveLength(0);
  });
});

describe('superOrderBlocks', () => {
  it('returns empty for insufficient candles', () => {
    expect(superOrderBlocks(makeCandles(5, 100))).toHaveLength(0);
  });
});

describe('StreamingSMA', () => {
  it('returns NaN until period is filled', () => {
    const s = new StreamingSMA(3);
    expect(s.isReady).toBe(false);
    expect(Number.isNaN(s.update(1))).toBe(true);
    expect(s.isReady).toBe(false);
    expect(Number.isNaN(s.update(2))).toBe(true);
    expect(s.isReady).toBe(false);
  });

  it('computes correct average once ready', () => {
    const s = new StreamingSMA(3);
    s.update(1);
    s.update(2);
    const val = s.update(3);
    expect(val).toBeCloseTo(2);
    expect(s.isReady).toBe(true);
    expect(s.value).toBeCloseTo(2);
  });

  it('slides the window', () => {
    const s = new StreamingSMA(3);
    s.update(1); s.update(2); s.update(3);
    expect(s.update(4)).toBeCloseTo(3);
    expect(s.update(5)).toBeCloseTo(4);
  });

  it('seed() sets immediate readiness', () => {
    const s = new StreamingSMA(3);
    s.seed(10);
    expect(s.isReady).toBe(true);
    expect(s.value).toBeCloseTo(10);
    expect(s.update(13)).toBeCloseTo(11);
  });

  it('reset() clears state', () => {
    const s = new StreamingSMA(3);
    s.seed(10);
    s.reset();
    expect(s.isReady).toBe(false);
  });
});

describe('StreamingEMA', () => {
  it('returns NaN during warmup', () => {
    const e = new StreamingEMA(3);
    expect(e.isReady).toBe(false);
    expect(Number.isNaN(e.update(1))).toBe(true);
    expect(Number.isNaN(e.update(2))).toBe(true);
    expect(e.isReady).toBe(false);
  });

  it('seeds with SMA at period-th value', () => {
    const e = new StreamingEMA(3);
    e.update(1); e.update(2);
    const val = e.update(3);
    expect(e.isReady).toBe(true);
    expect(val).toBeCloseTo(2);
  });

  it('smooths subsequent values with EMA formula', () => {
    const e = new StreamingEMA(3);
    e.update(1); e.update(2); e.update(3);
    const k = 2 / 4;
    const expected = 4 * k + 2 * (1 - k);
    expect(e.update(4)).toBeCloseTo(expected);
  });

  it('seed() sets immediate readiness', () => {
    const e = new StreamingEMA(3);
    e.seed(50);
    expect(e.isReady).toBe(true);
    expect(e.value).toBeCloseTo(50);
  });

  it('reset() clears state', () => {
    const e = new StreamingEMA(3);
    e.seed(50);
    e.reset();
    expect(e.isReady).toBe(false);
  });

  it('matches batch ema() output after seeding from batch', () => {
    const values = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1);
    const batch = ema(values, 10);
    const lastBatch = batch[49] as number;
    expect(lastBatch).not.toBeNull();

    const stream = new StreamingEMA(10);
    stream.seed(lastBatch);
    const nextPrice = values[49] + 1;
    const streamNext = stream.update(nextPrice);

    const extendedBatch = ema([...values, nextPrice], 10);
    expect(streamNext).toBeCloseTo(extendedBatch[50] as number);
  });
});

describe('performance: full snapshot on 1000 candles', () => {
  const config: IndicatorConfig = {
    rsiPeriod: 14, emaFast: 20, emaSlow: 50,
    macdFast: 12, macdSlow: 26, macdSignal: 9,
    atrPeriod: 14, bbPeriod: 20, bbStdDev: 2,
  };
  const candles = makeCandles(1000, 100);

  it('computeIndicators completes under 150ms', () => {
    const start = performance.now();
    computeIndicators(candles, config, []);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  it('buildFullSnapshot completes under 150ms', () => {
    const start = performance.now();
    buildFullSnapshot(candles, config, []);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  it('streaming update is faster than batch on single tick', () => {
    const stream = new StreamingEMA(20);
    const batchEma = ema(candles.map((c) => c.close), 20);
    stream.seed(batchEma[999] as number);
    const startStream = performance.now();
    stream.update(candles[999].close + 0.5);
    const streamElapsed = performance.now() - startStream;

    const closes = candles.map((c) => c.close);
    const startBatch = performance.now();
    ema(closes, 20);
    const batchElapsed = performance.now() - startBatch;

    expect(streamElapsed).toBeLessThan(batchElapsed);
  });
});
