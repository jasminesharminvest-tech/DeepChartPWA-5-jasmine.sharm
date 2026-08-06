import type {
  Candle,
  CalibrationResult,
  IndicatorConfig,
  Timeframe,
  FeatureName,
} from '@/types/domain';
import { buildFullSnapshot } from '@/compute/full-snapshot';
import { buildSignal } from './signal-builder';
import { estimateSpread } from './spread-estimate';

const ATR_MULTIPLIER_OPTIONS = [1.5, 2, 2.5, 3];
const DEFAULT_MULT = 2;
const MIN_TRADES = 8;

export function calibrate(
  symbolId: string,
  timeframe: Timeframe,
  candles: Candle[],
  config: IndicatorConfig,
  pipSize: number,
): CalibrationResult {
  const features: FeatureName[] = [];
  const { snapshot: lastSnapshot } = buildFullSnapshot(candles, config, features);
  const atrValue = lastSnapshot.indicators.atr ?? null;
  let best: CalibrationResult | null = null;

  for (const mult of ATR_MULTIPLIER_OPTIONS) {
    const trades = backtest(symbolId, timeframe, candles, config, mult, features);
    if (trades.length < MIN_TRADES) continue;
    let wins = 0;
    for (const t of trades) if (t.win) wins += 1;
    const winRate = wins / trades.length;
    const stopPips = atrValue !== null ? (atrValue * mult) / pipSize : 0;
    const tpPips = atrValue !== null ? (atrValue * mult * 2) / pipSize : 0;
    const candidate: CalibrationResult = {
      symbolId,
      timeframe,
      atrMultiplier: mult,
      stopLossPips: stopPips,
      takeProfitPips: tpPips,
      winRate,
      totalTrades: trades.length,
      calibratedAt: Date.now(),
    };
    if (best === null || winRate > best.winRate) best = candidate;
  }

  if (best) return best;

  const stopPips = atrValue !== null ? (atrValue * DEFAULT_MULT) / pipSize : 0;
  const tpPips = atrValue !== null ? (atrValue * DEFAULT_MULT * 2) / pipSize : 0;
  return {
    symbolId,
    timeframe,
    atrMultiplier: DEFAULT_MULT,
    stopLossPips: stopPips,
    takeProfitPips: tpPips,
    winRate: 0,
    totalTrades: 0,
    calibratedAt: Date.now(),
  };
}

interface BacktestTrade {
  win: boolean;
}

function backtest(
  symbolId: string,
  timeframe: Timeframe,
  candles: Candle[],
  config: IndicatorConfig,
  atrMultiplier: number,
  activeFeatures: FeatureName[],
): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  const warmup = Math.max(config.emaSlow, config.bbPeriod, config.macdSlow, config.rsiPeriod, config.atrPeriod) + 5;
  if (candles.length <= warmup + 10) return trades;

  for (let i = warmup; i < candles.length - 5; i++) {
    const slice = candles.slice(0, i + 1);
    const { snapshot } = buildFullSnapshot(slice, config, activeFeatures);
    const signal = buildSignal({
      symbolId,
      timeframe,
      candles: slice,
      config,
      atrMultiplier,
      activeFeatures,
      snapshot,
      calibration: null,
      tick: null,
      barsToResolve: 5,
    });
    if (!signal) continue;
    const stop = signal.stopLoss;
    const tp = signal.takeProfit;
    const isLong = signal.direction === 'buy';
    let resolved = false;
    let win = false;
    for (let j = i + 1; j < Math.min(candles.length, i + 6); j++) {
      const c = candles[j];
      if (isLong) {
        if (c.low <= stop) { resolved = true; win = false; break; }
        if (c.high >= tp) { resolved = true; win = true; break; }
      } else {
        if (c.high >= stop) { resolved = true; win = false; break; }
        if (c.low <= tp) { resolved = true; win = true; break; }
      }
    }
    if (resolved) trades.push({ win });
  }
  return trades;
}

export function estimateCalibrationSpread(symbolId: string): ReturnType<typeof estimateSpread> {
  return estimateSpread(symbolId, null);
}
