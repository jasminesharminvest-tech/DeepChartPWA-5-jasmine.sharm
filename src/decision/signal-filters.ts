import type { Candle, SignalDirection, Snapshot } from '@/types/domain';
import { orderBlockStrength, detectImbalances } from '@/compute/indicators/order-block-strength';
import { computeStructure } from '@/compute/indicators/trend-structure';
import { lastNonNull } from '@/compute/indicators/helpers';
import { atr } from '@/compute/indicators/atr';
import { isPatternInRange } from './direction-prediction';

export const CONTEXT_PENALTY = 0.3;
export const CONFIRMATION_BONUS = 0.25;

export interface FilterResult {
  scoreMultiplier: number;
  confirmed: boolean;
  invalidated: boolean;
  reasons: string[];
}

// False-signal filter: apply context penalty, confirmation bonuses, and invalidation check.
export function applySignalFilters(
  candles: Candle[],
  snapshot: Snapshot,
  direction: SignalDirection,
  _baseScore: number,
): FilterResult {
  const reasons: string[] = [];
  let scoreMultiplier = 1;
  let confirmed = false;
  let invalidated = false;

  // Context: pattern in the middle of a range with no tie to S/R/OB → weight × 0.3
  // Only applies when a pattern was actually detected
  const hasPattern = snapshot.patterns.length > 0;
  if (hasPattern && isPatternInRange(candles, snapshot)) {
    scoreMultiplier *= CONTEXT_PENALTY;
    reasons.push('Pattern in range with no S/R/OB context — score reduced');
  }

  // Confirmation: signal strengthened if there's an untouched OB of same direction nearby (±3 candles)
  const obZones = orderBlockStrength(candles);
  const recentOBs = obZones.slice(-3);
  const hasSameDirOB = recentOBs.some((z) =>
    !z.mitigated &&
    ((direction === 'buy' && z.direction === 'bullish') ||
      (direction === 'sell' && z.direction === 'bearish')),
  );
  if (hasSameDirOB) {
    scoreMultiplier += CONFIRMATION_BONUS;
    confirmed = true;
    reasons.push('Untouched OB of same direction nearby — score strengthened');
  }

  // Confirmation: untouched FVG nearby
  const fvgs = detectImbalances(candles);
  const activeFvgs = fvgs.filter((f) => !f.filled);
  const hasSameDirFVG = activeFvgs.some((f) =>
    (direction === 'buy' && f.direction === 'bullish') ||
    (direction === 'sell' && f.direction === 'bearish'),
  );
  if (hasSameDirFVG) {
    scoreMultiplier += CONFIRMATION_BONUS * 0.8;
    confirmed = true;
    reasons.push('Untouched FVG nearby — score strengthened');
  }

  // Confirmation: BOS/CHoCH in the signal's direction
  const structure = computeStructure(candles);
  const hasStructConfirm =
    (direction === 'buy' && structure.bos && structure.trend === 'up') ||
    (direction === 'sell' && structure.bos && structure.trend === 'down') ||
    (direction === 'buy' && structure.choch && structure.trend === 'up') ||
    (direction === 'sell' && structure.choch && structure.trend === 'down');
  if (hasStructConfirm) {
    scoreMultiplier += CONFIRMATION_BONUS;
    confirmed = true;
    reasons.push('BOS/CHoCH confirms signal direction');
  }

  // Invalidation: price closes past the pattern's extreme in the opposite direction
  if (candles.length >= 2) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atrArr = atr(candles, 14);
    const atrValue = lastNonNull(atrArr);
    const extremeBuffer = atrValue ? atrValue * 0.1 : 0;

    if (direction === 'buy') {
      // For a buy signal, invalidation if price closes below the prior candle's low
      if (last.close < prev.low - extremeBuffer) {
        invalidated = true;
        reasons.push('Price closed below pattern extreme — signal invalidated');
      }
    } else {
      // For a sell signal, invalidation if price closes above the prior candle's high
      if (last.close > prev.high + extremeBuffer) {
        invalidated = true;
        reasons.push('Price closed above pattern extreme — signal invalidated');
      }
    }
  }

  if (invalidated) {
    scoreMultiplier = 0;
  }

  return { scoreMultiplier, confirmed, invalidated, reasons };
}
