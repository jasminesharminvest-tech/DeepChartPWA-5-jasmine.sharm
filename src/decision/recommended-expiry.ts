import type { Timeframe } from '@/types/domain';
import { TIMEFRAME_SECONDS } from '@/data/symbols';

export function recommendedExpiry(
  timeframe: Timeframe,
  atr: number,
  entryPrice: number,
): number {
  if (atr <= 0 || entryPrice <= 0) return TIMEFRAME_SECONDS[timeframe];
  const volatilityPct = atr / entryPrice;
  const baseBars = volatilityPct < 0.005 ? 3 : volatilityPct < 0.01 ? 2 : 1;
  return Math.round(TIMEFRAME_SECONDS[timeframe] * baseBars);
}
