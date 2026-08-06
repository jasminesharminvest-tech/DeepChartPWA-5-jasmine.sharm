import { describe, it, expect } from 'vitest';
import { resample } from './resampler';
import { computeMetrics } from './metrics';
import type { SimulatedTrade } from './simulator';
import type { Candle, Signal } from '@/types/domain';

function makeCandle(time: number, close: number): Candle {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

function makeSignal(time: number, prob: number): Signal {
  return {
    id: `test:${time}`,
    symbolId: 'BTCUSDT',
    direction: 'buy',
    strength: 'moderate',
    score: 3,
    calibratedProbability: prob,
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    reason: 'test',
    indicators: {
      rsi: 50,
      emaFast: 100,
      emaSlow: 99,
      macd: 0.5,
      macdSignal: 0.3,
      macdHistogram: 0.2,
      atr: 2,
      bollingerUpper: 105,
      bollingerMiddle: 100,
      bollingerLower: 95,
      vwap: 100,
      volumeProfilePoc: 100,
      meanReversionRsi: null,
      impulseVelocity: null,
    },
    pattern: null,
    time,
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
    featureVector: [0.5, 0.01, 0.2, 0.1, 2, 100, 0, 1, 0, 1, 0, 0],
  };
}

function makeTrade(
  time: number,
  prob: number,
  outcome: 'win' | 'loss' | 'timeout',
): SimulatedTrade {
  return {
    signal: makeSignal(time, prob),
    outcome,
    entryTime: time,
    candleIndex: 0,
    spreadCostR: 0,
    inSample: true,
  };
}

describe('resampler', () => {
  it('returns 1m candles unchanged', () => {
    const candles = [makeCandle(0, 100), makeCandle(60, 101), makeCandle(120, 102)];
    const result = resample(candles, '1m');
    expect(result).toHaveLength(3);
    expect(result[0].close).toBe(100);
  });

  it('resamples 1m to 5m correctly', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 10; i++) {
      candles.push({
        time: i * 60,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100 + i,
        volume: 10,
      });
    }
    const result = resample(candles, '5m');
    expect(result).toHaveLength(2);
    expect(result[0].time).toBe(0);
    expect(result[0].open).toBe(100);
    expect(result[0].high).toBe(105);
    expect(result[0].low).toBe(99);
    expect(result[0].close).toBe(104);
    expect(result[0].volume).toBe(50);
  });

  it('handles partial bucket at end', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 7; i++) {
      candles.push({ time: i * 60, open: 100, high: 101, low: 99, close: 100, volume: 10 });
    }
    const result = resample(candles, '5m');
    expect(result).toHaveLength(2);
    expect(result[1].volume).toBe(20);
  });
});

describe('metrics', () => {
  it('handles zero trades', () => {
    const m = computeMetrics([]);
    expect(m.totalTrades).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.brierScore).toBe(0);
  });

  it('computes win rate correctly', () => {
    const trades = [
      makeTrade(0, 0.6, 'win'),
      makeTrade(60, 0.6, 'loss'),
      makeTrade(120, 0.6, 'win'),
      makeTrade(180, 0.6, 'timeout'),
    ];
    const m = computeMetrics(trades);
    expect(m.totalTrades).toBe(4);
    expect(m.wins).toBe(2);
    expect(m.losses).toBe(1);
    expect(m.timeouts).toBe(1);
    expect(m.winRate).toBe(0.5);
  });

  it('computes average R with 2:1 RR', () => {
    const trades = [makeTrade(0, 0.6, 'win'), makeTrade(60, 0.6, 'loss')];
    const m = computeMetrics(trades);
    expect(m.averageR).toBeCloseTo(0.5, 5);
  });

  it('computes Brier score', () => {
    const trades = [
      makeTrade(0, 0.8, 'win'),
      makeTrade(60, 0.3, 'loss'),
    ];
    const m = computeMetrics(trades);
    expect(m.brierScore).toBeCloseTo(0.065, 5);
  });

  it('computes max drawdown', () => {
    const trades = [
      makeTrade(0, 0.6, 'win'),
      makeTrade(60, 0.6, 'loss'),
      makeTrade(120, 0.6, 'loss'),
      makeTrade(180, 0.6, 'win'),
    ];
    const m = computeMetrics(trades);
    expect(m.maxDrawdownR).toBe(2);
  });

  it('computes profit factor', () => {
    const trades = [
      makeTrade(0, 0.6, 'win'),
      makeTrade(60, 0.6, 'win'),
      makeTrade(120, 0.6, 'loss'),
    ];
    const m = computeMetrics(trades);
    expect(m.profitFactor).toBeCloseTo(4, 5);
  });

  it('builds reliability bins', () => {
    const trades = [
      makeTrade(0, 0.05, 'loss'),
      makeTrade(60, 0.15, 'loss'),
      makeTrade(120, 0.85, 'win'),
      makeTrade(180, 0.95, 'win'),
    ];
    const m = computeMetrics(trades);
    expect(m.reliabilityBins).toHaveLength(10);
    expect(m.reliabilityBins[0].count).toBe(1);
    expect(m.reliabilityBins[0].avgActual).toBe(0);
    expect(m.reliabilityBins[9].count).toBe(1);
    expect(m.reliabilityBins[9].avgActual).toBe(1);
  });
});
