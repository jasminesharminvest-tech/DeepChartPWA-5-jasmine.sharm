import { describe, it, expect } from 'vitest';
import type { Candle, IndicatorConfig, Signal } from '@/types/domain';
import { buildSignal, buildFeatureVector, generateSignalId, shouldRevise, sigmoidFallback, reviseSignal } from './signal-builder';
import { CalibrationModel } from './calibration-model';
import type { Snapshot } from '@/types/domain';

const CONFIG: IndicatorConfig = {
  rsiPeriod: 14,
  emaFast: 9,
  emaSlow: 21,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  bbPeriod: 20,
  bbStdDev: 2,
};

function makeCandles(uptrend: boolean): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 60; i++) {
    const change = uptrend ? 1.5 : -1.5;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;
    candles.push({ time: i * 60, open, high, low, close, volume: 100 });
    price = close;
  }
  return candles;
}

function makeSnapshot(candles: Candle[], indicators: Partial<Signal['indicators']>): Snapshot {
  return {
    indicators: { ...candles[candles.length - 1], ...indicators } as Signal['indicators'],
    patterns: [],
    structure: { trend: 'range', bos: false, choch: false, swingHigh: null, swingLow: null },
    regime: 'range',
    lastPrice: candles[candles.length - 1].close,
    candleTime: candles[candles.length - 1].time,
  };
}

describe('generateSignalId', () => {
  it('produces deterministic IDs per candle', () => {
    const id1 = generateSignalId('BTCUSDT', '15m', 1000);
    const id2 = generateSignalId('BTCUSDT', '15m', 1000);
    expect(id1).toBe(id2);
    expect(id1).toBe('BTCUSDT:15m:1000');
  });
});

describe('buildFeatureVector', () => {
  it('includes only non-null indicators', () => {
    const snap = makeSnapshot(makeCandles(true), {
      rsi: 65,
      emaFast: 110,
      emaSlow: 105,
      macdHistogram: 0.5,
      atr: 2,
      bollingerUpper: 115,
      bollingerMiddle: 105,
      bollingerLower: 95,
    });
    const vec = buildFeatureVector(snap);
    expect(vec.values.length).toBeGreaterThan(0);
    expect(vec.keys).toContain('rsi');
    expect(vec.keys).toContain('ema_cross');
    expect(vec.keys).toContain('macd_hist');
  });

  it('returns fixed-length vector even with all null indicators', () => {
    const snap = makeSnapshot(makeCandles(true), {
      rsi: null,
      emaFast: null,
      emaSlow: null,
      macdHistogram: null,
      atr: null,
      bollingerUpper: null,
      bollingerMiddle: null,
      bollingerLower: null,
      vwap: null,
      volumeProfilePoc: null,
      meanReversionRsi: null,
      impulseVelocity: null,
    });
    const vec = buildFeatureVector(snap);
    expect(vec.values.length).toBe(12);
    expect(vec.values.every((v) => v === 0)).toBe(true);
  });
});

describe('sigmoidFallback', () => {
  it('returns 0.5 for score 0', () => {
    expect(sigmoidFallback(0)).toBeCloseTo(0.5, 3);
  });

  it('returns higher probability for higher score', () => {
    expect(sigmoidFallback(5)).toBeGreaterThan(sigmoidFallback(0));
    expect(sigmoidFallback(10)).toBeGreaterThan(sigmoidFallback(5));
  });

  it('is bounded in [0, 1]', () => {
    expect(sigmoidFallback(-100)).toBeGreaterThanOrEqual(0);
    expect(sigmoidFallback(100)).toBeLessThanOrEqual(1);
  });
});

describe('shouldRevise', () => {
  it('returns true when delta > 3', () => {
    expect(shouldRevise(6, 2)).toBe(true);
    expect(shouldRevise(2, 6)).toBe(true);
  });

  it('returns false when delta <= 3', () => {
    expect(shouldRevise(4, 2)).toBe(false);
    expect(shouldRevise(2, 4)).toBe(false);
  });
});

describe('reviseSignal', () => {
  it('updates score, reason, and marks as revised', () => {
    const candles = makeCandles(true);
    const snap = makeSnapshot(candles, {
      rsi: 25, emaFast: 110, emaSlow: 105, macdHistogram: -0.5, atr: 2,
      bollingerUpper: 115, bollingerMiddle: 105, bollingerLower: 95,
    });
    const signal: Signal = {
      id: 'test:1',
      symbolId: 'BTCUSDT',
      direction: 'buy',
      strength: 'moderate',
      score: 2,
      calibratedProbability: 0.5,
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110,
      reason: 'initial',
      indicators: snap.indicators,
      pattern: null,
      time: 100,
      timeframe: '15m',
      outcome: 'pending',
      frozenAt: null,
      isRevised: false,
      isPreClose: false,
      revisionNote: null,
      barsToResolve: 5,
      spread: null,
      spreadSource: null,
      recommendedExpiry: 900,
      featureVector: new Array(12).fill(0),
    };
    const revised = reviseSignal(signal, 6, 'new reasons', snap, null);
    expect(revised.isRevised).toBe(true);
    expect(revised.score).toBe(6);
    expect(revised.reason).toBe('new reasons');
    expect(revised.revisionNote).toContain('2');
    expect(revised.revisionNote).toContain('6');
  });
});

describe('buildSignal', () => {
  it('returns null when score < 2', () => {
    const candles = makeCandles(true);
    const snap = makeSnapshot(candles, {
      rsi: 50, emaFast: 105, emaSlow: 105, macdHistogram: 0, atr: 2,
      bollingerUpper: 115, bollingerMiddle: 105, bollingerLower: 95,
    });
    const signal = buildSignal({
      symbolId: 'BTCUSDT', timeframe: '15m', candles, config: CONFIG, atrMultiplier: 2,
      activeFeatures: [], snapshot: snap, calibration: null, tick: null, barsToResolve: 5,
    });
    expect(signal).toBeNull();
  });

  it('uses fallback sigmoid when calibration not ready', () => {
    const candles = makeCandles(true);
    const snap = makeSnapshot(candles, {
      rsi: 25, emaFast: 110, emaSlow: 100, macdHistogram: 1, atr: 2,
      bollingerUpper: 115, bollingerMiddle: 105, bollingerLower: 95,
    });
    const signal = buildSignal({
      symbolId: 'BTCUSDT', timeframe: '15m', candles, config: CONFIG, atrMultiplier: 2,
      activeFeatures: [], snapshot: snap, calibration: null, tick: null, barsToResolve: 5,
    });
    expect(signal).not.toBeNull();
    expect(signal!.calibratedProbability).not.toBeNull();
    expect(signal!.calibratedProbability).toBeGreaterThan(0.5);
  });

  it('uses calibrated probability when model is ready', () => {
    const candles = makeCandles(true);
    const snap = makeSnapshot(candles, {
      rsi: 25, emaFast: 110, emaSlow: 100, macdHistogram: 1, atr: 2,
      bollingerUpper: 115, bollingerMiddle: 105, bollingerLower: 95,
    });
    const model = new CalibrationModel(12);
    for (let i = 0; i < 15; i++) {
      model.addSample({ features: new Array(12).fill(0.5), score: 3, outcome: 1 });
    }
    model.retrain();
    const signal = buildSignal({
      symbolId: 'BTCUSDT', timeframe: '15m', candles, config: CONFIG, atrMultiplier: 2,
      activeFeatures: [], snapshot: snap, calibration: model, tick: null, barsToResolve: 5,
    });
    expect(signal).not.toBeNull();
    expect(signal!.calibratedProbability).not.toBeNull();
    expect(signal!.calibratedProbability).toBeGreaterThan(0);
    expect(signal!.calibratedProbability).toBeLessThan(1);
  });

  it('populates trade levels, spread, and expiry', () => {
    const candles = makeCandles(true);
    const snap = makeSnapshot(candles, {
      rsi: 25, emaFast: 110, emaSlow: 100, macdHistogram: 1, atr: 2,
      bollingerUpper: 115, bollingerMiddle: 105, bollingerLower: 95,
    });
    const tick = { price: 100, time: 0, bid: 99.9, ask: 100.1 };
    const signal = buildSignal({
      symbolId: 'BTCUSDT', timeframe: '15m', candles, config: CONFIG, atrMultiplier: 2,
      activeFeatures: [], snapshot: snap, calibration: null, tick, barsToResolve: 5,
    });
    expect(signal).not.toBeNull();
    expect(signal!.entryPrice).toBeGreaterThan(0);
    expect(signal!.stopLoss).toBeGreaterThan(0);
    expect(signal!.takeProfit).toBeGreaterThan(0);
    expect(signal!.spread).toBeCloseTo(0.2, 5);
    expect(signal!.spreadSource).toBe('live');
    expect(signal!.recommendedExpiry).toBeGreaterThan(0);
    expect(signal!.barsToResolve).toBe(5);
    expect(signal!.frozenAt).toBeNull();
    expect(signal!.isRevised).toBe(false);
  });
});
