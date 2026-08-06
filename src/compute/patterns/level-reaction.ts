import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { supportResistance } from '@/compute/indicators/support-resistance';
import { lastNonNull } from '@/compute/indicators/helpers';
import { atr } from '@/compute/indicators/atr';

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Level reaction: price reacts to a key S/R level.
export function detectLevelReaction(candles: Candle[]): PatternResult | null {
  if (candles.length < 15) return null;

  const levels = supportResistance(candles, 14);
  if (levels.length === 0) return null;

  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (atrValue === null || atrValue <= 0) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const proximityThreshold = atrValue * 0.3;

  for (const level of levels) {
    const distance = Math.abs(last.close - level.price);
    if (distance > proximityThreshold) continue;

    if (level.type === 'support' && prev.low <= level.price && last.close > level.price) {
      const confidence = clamp01(level.strength / 6);
      return {
        name: 'level-reaction',
        direction: 'buy',
        confidence: Math.max(0.4, confidence),
        strength: strengthForConfidence(confidence),
        time: last.time,
      };
    }
    if (level.type === 'resistance' && prev.high >= level.price && last.close < level.price) {
      const confidence = clamp01(level.strength / 6);
      return {
        name: 'level-reaction',
        direction: 'sell',
        confidence: Math.max(0.4, confidence),
        strength: strengthForConfidence(confidence),
        time: last.time,
      };
    }
  }
  return null;
}
