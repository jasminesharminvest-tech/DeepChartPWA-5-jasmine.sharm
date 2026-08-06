import type { IndicatorSnapshot } from '@/types/domain';

export interface TradeLevels {
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

export const MIN_RR = 1.5;

export function computeTradeLevels(
  entryPrice: number,
  atr: number,
  atrMultiplier: number,
  direction: 'buy' | 'sell',
): TradeLevels {
  const stopDistance = atr * atrMultiplier;
  const isBuy = direction === 'buy';
  return {
    entry: entryPrice,
    stopLoss: isBuy ? entryPrice - stopDistance : entryPrice + stopDistance,
    takeProfit: isBuy ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2,
  };
}

export function riskRewardRatio(levels: TradeLevels): number {
  const risk = Math.abs(levels.entry - levels.stopLoss);
  if (risk <= 0) return 0;
  const reward = Math.abs(levels.takeProfit - levels.entry);
  return reward / risk;
}

// Shared by live trading and backtest: returns null if R:R < 1.5, so the trade is not registered.
export function estimateTradeLevels(
  entryPrice: number,
  atr: number,
  atrMultiplier: number,
  direction: 'buy' | 'sell',
): TradeLevels | null {
  const levels = computeTradeLevels(entryPrice, atr, atrMultiplier, direction);
  if (riskRewardRatio(levels) < MIN_RR) return null;
  return levels;
}

export function avgRangeFromSnapshot(
  candles: { high: number; low: number }[],
  period: number,
): number {
  const slice = candles.slice(-period);
  if (slice.length === 0) return 0;
  let sum = 0;
  for (const c of slice) sum += c.high - c.low;
  return sum / slice.length;
}

export function fallbackAtr(snapshot: IndicatorSnapshot, candles: { high: number; low: number }[], period: number): number {
  if (snapshot.atr !== null && snapshot.atr > 0) return snapshot.atr;
  return avgRangeFromSnapshot(candles, period);
}
