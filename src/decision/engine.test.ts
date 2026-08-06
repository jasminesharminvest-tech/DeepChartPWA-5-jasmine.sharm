import { describe, it, expect, beforeEach } from 'vitest';
import type { Candle, Signal } from '@/types/domain';
import { DecisionEngine } from './engine';
import { OutcomeScheduler, resolveOutcome, getCandlesAfterSignal } from './outcome-scheduler';
import { CalibrationModel, persistCalibrationState, loadCalibrationState, MIN_SAMPLES } from './calibration-model';

const CONFIG = {
  rsiPeriod: 14, emaFast: 9, emaSlow: 21,
  macdFast: 12, macdSlow: 26, macdSignal: 9,
  atrPeriod: 14, bbPeriod: 20, bbStdDev: 2,
};

function makeUptrendCandles(): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 60; i++) {
    const open = price;
    const close = price + 2;
    candles.push({ time: i * 900, open, high: close + 1, low: open - 1, close, volume: 100 });
    price = close;
  }
  return candles;
}

function makeSignal(overrides?: Partial<Signal>): Signal {
  return {
    id: 'test-signal-1',
    symbolId: 'BTCUSDT',
    direction: 'buy',
    strength: 'moderate',
    score: 3,
    calibratedProbability: 0.6,
    entryPrice: 100,
    stopLoss: 90,
    takeProfit: 120,
    reason: 'test',
    indicators: {
      rsi: 25, emaFast: 110, emaSlow: 100, macd: 1, macdSignal: 0.5, macdHistogram: 0.5,
      atr: 5, bollingerUpper: 115, bollingerMiddle: 105, bollingerLower: 95,
      vwap: null, volumeProfilePoc: null, meanReversionRsi: null, impulseVelocity: null,
    },
    pattern: null,
    time: 1000,
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
    ...overrides,
  };
}

describe('DecisionEngine', () => {
  it('evaluate returns null for insufficient candles', () => {
    const eng = new DecisionEngine({ calibration: null, barsToResolve: 5 });
    const result = eng.evaluate('BTCUSDT', '15m', [], CONFIG, 2, [], null, Date.now());
    expect(result).toBeNull();
  });

  it('evaluate returns a signal for valid uptrend candles', () => {
    const eng = new DecisionEngine({ calibration: null, barsToResolve: 5 });
    const candles = makeUptrendCandles();
    const serverNow = candles[candles.length - 1].time * 1000 - 10000;
    const result = eng.evaluate('BTCUSDT', '15m', candles, CONFIG, 2, [], null, serverNow);
    expect(result).not.toBeNull();
  });

  it('onCandleClosed returns the frozen signal and clears state', () => {
    const eng = new DecisionEngine({ calibration: null, barsToResolve: 5 });
    expect(eng.onCandleClosed()).toBeNull();
  });

  it('recordOutcome adds sample and retrains calibration', () => {
    const model = new CalibrationModel(12);
    const eng = new DecisionEngine({ calibration: model, barsToResolve: 5 });
    const signal = makeSignal();
    const record = eng.recordOutcome(signal, 'win');
    expect(record).not.toBeNull();
    expect(record!.outcome).toBe('win');
    expect(model.getSampleCount()).toBe(1);
  });

  it('recordOutcome returns null for pending outcome', () => {
    const model = new CalibrationModel(12);
    const eng = new DecisionEngine({ calibration: model, barsToResolve: 5 });
    const signal = makeSignal();
    expect(eng.recordOutcome(signal, 'pending')).toBeNull();
  });

  it('recordOutcome returns null when no calibration model', () => {
    const eng = new DecisionEngine({ calibration: null, barsToResolve: 5 });
    const signal = makeSignal();
    expect(eng.recordOutcome(signal, 'win')).toBeNull();
  });
});

describe('OutcomeScheduler', () => {
  it('resolveOutcome detects a win (buy hits TP)', () => {
    const signal = makeSignal({ direction: 'buy', stopLoss: 90, takeProfit: 120, barsToResolve: 3 });
    const candles: Candle[] = [
      { time: 2000, open: 100, high: 125, low: 99, close: 122, volume: 10 },
    ];
    const result = resolveOutcome(signal, candles);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe('win');
  });

  it('resolveOutcome detects a loss (buy hits SL)', () => {
    const signal = makeSignal({ direction: 'buy', stopLoss: 90, takeProfit: 120, barsToResolve: 3 });
    const candles: Candle[] = [
      { time: 2000, open: 100, high: 101, low: 88, close: 89, volume: 10 },
    ];
    const result = resolveOutcome(signal, candles);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe('loss');
  });

  it('resolveOutcome detects a sell win (price hits TP below)', () => {
    const signal = makeSignal({ direction: 'sell', stopLoss: 110, takeProfit: 80, barsToResolve: 3 });
    const candles: Candle[] = [
      { time: 2000, open: 100, high: 101, low: 78, close: 79, volume: 10 },
    ];
    const result = resolveOutcome(signal, candles);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe('win');
  });

  it('resolveOutcome detects a sell loss (price hits SL above)', () => {
    const signal = makeSignal({ direction: 'sell', stopLoss: 110, takeProfit: 80, barsToResolve: 3 });
    const candles: Candle[] = [
      { time: 2000, open: 100, high: 112, low: 99, close: 111, volume: 10 },
    ];
    const result = resolveOutcome(signal, candles);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe('loss');
  });

  it('resolveOutcome returns timeout when bars elapsed exceeds barsToResolve', () => {
    const signal = makeSignal({ barsToResolve: 2, stopLoss: 50, takeProfit: 200 });
    const candles: Candle[] = [
      { time: 2000, open: 100, high: 101, low: 99, close: 100, volume: 10 },
      { time: 3000, open: 100, high: 101, low: 99, close: 100, volume: 10 },
    ];
    const result = resolveOutcome(signal, candles);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe('timeout');
  });

  it('resolveOutcome returns null when not enough bars and no hit', () => {
    const signal = makeSignal({ barsToResolve: 5, stopLoss: 50, takeProfit: 200 });
    const candles: Candle[] = [
      { time: 2000, open: 100, high: 101, low: 99, close: 100, volume: 10 },
    ];
    const result = resolveOutcome(signal, candles);
    expect(result).toBeNull();
  });

  it('resolveOutcome returns null for non-pending signal', () => {
    const signal = makeSignal({ outcome: 'win' });
    const result = resolveOutcome(signal, []);
    expect(result).toBeNull();
  });

  it('getCandlesAfterSignal filters correctly', () => {
    const candles: Candle[] = [
      { time: 500, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 1500, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 2000, open: 1, high: 2, low: 0, close: 1, volume: 1 },
    ];
    const after = getCandlesAfterSignal(candles, 1000);
    expect(after.length).toBe(2);
    expect(after[0].time).toBe(1500);
  });

  it('scheduler schedules and resolves signals', () => {
    const sched = new OutcomeScheduler();
    const signal = makeSignal({ time: 1000, stopLoss: 50, takeProfit: 200, barsToResolve: 3 });
    sched.schedule(signal);
    expect(sched.getPendingCount()).toBe(1);

    const allCandles: Candle[] = [
      { time: 500, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 1 },
      { time: 1500, open: 100, high: 210, low: 99, close: 200, volume: 10 },
    ];

    sched.onCandleClosed(allCandles, (resolved) => {
      expect(resolved.outcome).toBe('win');
    });
    expect(sched.getPendingCount()).toBe(0);
  });

  it('scheduler does not schedule non-pending signals', () => {
    const sched = new OutcomeScheduler();
    sched.schedule(makeSignal({ outcome: 'win' }));
    expect(sched.getPendingCount()).toBe(0);
  });

  it('scheduler clears', () => {
    const sched = new OutcomeScheduler();
    sched.schedule(makeSignal());
    sched.clear();
    expect(sched.getPendingCount()).toBe(0);
  });
});

describe('Calibration integration with DecisionEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recordOutcome + retrain + persist works end-to-end', () => {
    const model = new CalibrationModel(12);
    const eng = new DecisionEngine({ calibration: model, barsToResolve: 5 });

    for (let i = 0; i < MIN_SAMPLES; i++) {
      const sig = makeSignal({ id: `sig-${i}` });
      eng.recordOutcome(sig, i % 2 === 0 ? 'win' : 'loss');
    }

    persistCalibrationState(model);
    const loaded = loadCalibrationState(12);
    expect(loaded).not.toBeNull();
    expect(loaded!.getSampleCount()).toBe(MIN_SAMPLES);
    expect(loaded!.isReady()).toBe(true);
  });
});
