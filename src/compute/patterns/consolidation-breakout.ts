import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
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

// Consolidation breakout: narrow range period followed by breakout candle.
export function detectConsolidationBreakout(candles: Candle[], lookback: number = 10): PatternResult | null {
  if (candles.length < lookback + 1) return null;

  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (atrValue === null || atrValue <= 0) return null;

  const consolidation = candles.slice(-lookback - 1, -1);
  const ranges = consolidation.map((c) => c.high - c.low);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;

  if (avgRange > atrValue * 0.7) return null;

  const last = candles[candles.length - 1];
  const lastRange = last.high - last.low;
  if (lastRange < avgRange * 1.5) return null;

  const consolidationHigh = Math.max(...consolidation.map((c) => c.high));
  const consolidationLow = Math.min(...consolidation.map((c) => c.low));

  if (last.close > consolidationHigh) {
    const confidence = clamp01(lastRange / (avgRange * 2));
    return {
      name: 'consolidation-breakout',
      direction: 'buy',
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
    };
  }
  if (last.close < consolidationLow) {
    const confidence = clamp01(lastRange / (avgRange * 2));
    return {
      name: 'consolidation-breakout',
      direction: 'sell',
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
    };
  }
  return null;
}
