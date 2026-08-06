import { describe, it, expect } from 'vitest';
import { detectAllPatterns } from '@/compute/patterns';
import { detectHammer, detectDoji, detectShootingStar } from '@/compute/patterns/single';
import { detectBullishEngulfing, detectBearishEngulfing, detectBullishHarami, detectBearishHarami } from '@/compute/patterns/double';
import { detectMorningStar, detectEveningStar } from '@/compute/patterns/triple';
import { detectPinBar } from '@/compute/patterns/pin-bar';
import { detectInsideBar } from '@/compute/patterns/inside-bar';
import { detectMeanReversion } from '@/compute/patterns/mean-reversion';
import type { Candle, FeatureName } from '@/types/domain';

function candle(
  time: number,
  open: number,
  close: number,
  high: number,
  low: number,
  volume = 100,
): Candle {
  return { time, open, high, low, close, volume };
}

const ALL: FeatureName[] = [];

describe('detectAllPatterns', () => {
  it('returns empty for single candle', () => {
    expect(detectAllPatterns([candle(0, 1, 2, 2.5, 0.5)], ALL)).toEqual([]);
  });

  it('detects bullish engulfing', () => {
    const candles = [
      candle(0, 10, 8, 10.5, 7.5),
      candle(1, 7.5, 11, 11.5, 7),
    ];
    const patterns = detectAllPatterns(candles, ALL);
    expect(patterns.some((p) => p.name === 'bullish-engulfing')).toBe(true);
  });

  it('detects bearish engulfing', () => {
    const candles = [
      candle(0, 8, 10, 10.5, 7.5),
      candle(1, 11, 7.5, 11.5, 7),
    ];
    const patterns = detectAllPatterns(candles, ALL);
    expect(patterns.some((p) => p.name === 'bearish-engulfing')).toBe(true);
  });

  it('detects doji', () => {
    const candles = [
      candle(0, 10, 8, 10.5, 7.5),
      candle(1, 10, 10.01, 12, 8),
    ];
    const patterns = detectAllPatterns(candles, ALL);
    expect(patterns.some((p) => p.name === 'doji')).toBe(true);
  });

  it('detects hammer', () => {
    const candles = [
      candle(0, 10, 9, 10.5, 8),
      candle(1, 9, 9.5, 9.6, 7),
    ];
    const patterns = detectAllPatterns(candles, ALL);
    const hammer = patterns.find((p) => p.name === 'hammer');
    expect(hammer).toBeDefined();
    expect(hammer?.direction).toBe('buy');
  });

  it('filters out patterns not in activeFeatures', () => {
    const candles = [
      candle(0, 10, 8, 10.5, 7.5),
      candle(1, 7.5, 11, 11.5, 7),
    ];
    const patterns = detectAllPatterns(candles, ['doji'] as FeatureName[]);
    expect(patterns.some((p) => p.name === 'bullish-engulfing')).toBe(false);
    expect(patterns.some((p) => p.name === 'doji')).toBe(false);
  });
});

describe('detectHammer', () => {
  it('detects hammer with long lower wick', () => {
    const c = candle(0, 10, 10.5, 10.6, 8);
    const result = detectHammer(c);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('hammer');
    expect(result?.direction).toBe('buy');
  });

  it('returns null for non-hammer candle', () => {
    const c = candle(0, 10, 11, 11, 9.5);
    expect(detectHammer(c)).toBeNull();
  });
});

describe('detectShootingStar', () => {
  it('detects shooting star with long upper wick', () => {
    const c = candle(0, 11, 10.5, 13, 10.3);
    const result = detectShootingStar(c);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('shooting-star');
    expect(result?.direction).toBe('sell');
  });
});

describe('detectDoji', () => {
  it('detects doji when body is < 1% of range', () => {
    const c = candle(0, 10, 10.005, 11, 9);
    expect(detectDoji(c)).not.toBeNull();
  });

  it('returns null when body is too large', () => {
    const c = candle(0, 10, 11, 12, 9);
    expect(detectDoji(c)).toBeNull();
  });
});

describe('detectBullishEngulfing', () => {
  it('detects bullish engulfing pattern', () => {
    const prev = candle(0, 10, 8, 10.5, 7.5);
    const cur = candle(1, 7, 11, 11.5, 6.5);
    const result = detectBullishEngulfing(prev, cur);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('buy');
  });

  it('confidence varies with body ratio', () => {
    const prev1 = candle(0, 10, 9, 10.5, 8.5);
    const cur1 = candle(1, 8, 12, 12.5, 7.5);
    const prev2 = candle(0, 10, 9.9, 10.5, 9.5);
    const cur2 = candle(1, 9.5, 11, 11.5, 9);
    const r1 = detectBullishEngulfing(prev1, cur1);
    const r2 = detectBullishEngulfing(prev2, cur2);
    expect(r1?.confidence).not.toBe(r2?.confidence);
  });
});

describe('detectBearishEngulfing', () => {
  it('detects bearish engulfing pattern', () => {
    const prev = candle(0, 8, 10, 10.5, 7.5);
    const cur = candle(1, 11, 7, 11.5, 6.5);
    const result = detectBearishEngulfing(prev, cur);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('sell');
  });
});

describe('detectBullishHarami', () => {
  it('detects bullish harami', () => {
    const prev = candle(0, 10, 7, 10.5, 6.5);
    const cur = candle(1, 7.5, 8, 8.5, 7);
    const result = detectBullishHarami(prev, cur);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('buy');
  });
});

describe('detectBearishHarami', () => {
  it('detects bearish harami', () => {
    const prev = candle(0, 7, 10, 10.5, 6.5);
    const cur = candle(1, 9, 8.5, 9.5, 8);
    const result = detectBearishHarami(prev, cur);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('sell');
  });
});

describe('detectMorningStar', () => {
  it('detects morning star after downtrend', () => {
    const candles: Candle[] = [
      candle(0, 25, 23, 25.5, 22.5),
      candle(1, 23, 21, 24, 20),
      candle(2, 21, 19, 22, 18),
      candle(3, 19, 17, 20, 16),
      candle(4, 17, 15, 18, 14),
      candle(5, 15, 12, 16, 11),
      candle(6, 12, 10, 13, 9),
      candle(7, 10.5, 10.8, 11.5, 10),
      candle(8, 11, 14, 14.5, 10.5),
    ];
    const result = detectMorningStar(candles);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('buy');
  });

  it('requires preceding downtrend', () => {
    const candles: Candle[] = [
      candle(0, 10, 12, 12.5, 9.5),
      candle(1, 12, 14, 14.5, 11.5),
      candle(2, 14, 16, 16.5, 13.5),
      candle(3, 16, 15, 17, 14.5),
      candle(4, 15, 13, 16, 12),
      candle(5, 13, 12.5, 14, 12),
      candle(6, 12.5, 16, 16.5, 12),
    ];
    const result = detectMorningStar(candles);
    expect(result).toBeNull();
  });
});

describe('detectEveningStar', () => {
  it('detects evening star after uptrend', () => {
    const candles: Candle[] = [
      candle(0, 8, 10, 10.5, 7.5),
      candle(1, 10, 12, 12.5, 9.5),
      candle(2, 12, 14, 14.5, 11.5),
      candle(3, 14, 16, 16.5, 13.5),
      candle(4, 16, 18, 18.5, 15.5),
      candle(5, 18, 20, 20.5, 17.5),
      candle(6, 20, 19.5, 21, 19),
      candle(7, 19.5, 15, 20, 14.5),
    ];
    const result = detectEveningStar(candles);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('sell');
  });
});

describe('detectPinBar', () => {
  it('detects bullish pin bar with long lower wick', () => {
    const c = candle(0, 10, 10.5, 11, 7);
    const result = detectPinBar(c);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('buy');
  });

  it('detects bearish pin bar with long upper wick', () => {
    const c = candle(0, 10, 9.5, 13, 9);
    const result = detectPinBar(c);
    expect(result).not.toBeNull();
    expect(result?.direction).toBe('sell');
  });

  it('body must be ≤ 1/3 of range', () => {
    const c = candle(0, 10, 12, 13, 9);
    expect(detectPinBar(c)).toBeNull();
  });
});

describe('detectInsideBar', () => {
  it('detects inside bar', () => {
    const prev = candle(0, 10, 12, 13, 9);
    const cur = candle(1, 10.5, 11, 11.5, 10);
    const result = detectInsideBar(prev, cur);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('inside-bar');
  });

  it('returns null when current exceeds previous range', () => {
    const prev = candle(0, 10, 12, 13, 9);
    const cur = candle(1, 10.5, 14, 14.5, 10);
    expect(detectInsideBar(prev, cur)).toBeNull();
  });
});

describe('detectMeanReversion', () => {
  it('does not conflict with SMC trend (BOS suppresses)', () => {
    const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
      time: i,
      open: 100 + i * 2,
      high: 103 + i * 2,
      low: 99 + i * 2,
      close: 102 + i * 2,
      volume: 100,
    }));
    const snapshot = {
      rsi: 80, emaFast: 170, emaSlow: 160,
      macd: 10, macdSignal: 8, macdHistogram: 2,
      atr: 3, bollingerUpper: 180, bollingerMiddle: 150, bollingerLower: 120,
      vwap: null, volumeProfilePoc: null, meanReversionRsi: null, impulseVelocity: null,
    };
    const result = detectMeanReversion(candles, snapshot, 80);
    expect(result).toBeNull();
  });
});
