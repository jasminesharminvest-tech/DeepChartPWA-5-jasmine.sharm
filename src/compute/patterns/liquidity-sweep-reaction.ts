import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { detectLiquiditySweep } from './liquidity-sweep';
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

// Liquidity sweep reaction: sweep followed by a confirmation candle in the reversal direction.
export function detectLiquiditySweepReaction(candles: Candle[]): PatternResult | null {
  if (candles.length < 22) return null;

  const sweep = detectLiquiditySweep(candles.slice(0, -1));
  if (!sweep) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (atrValue === null || atrValue <= 0) return null;

  if (sweep.direction === 'buy') {
    if (last.close > last.open && last.close > prev.high) {
      const body = Math.abs(last.close - last.open);
      const confidence = clamp01(Math.min(sweep.confidence + body / (atrValue * 2), 1));
      return {
        name: 'liquidity-sweep-reaction',
        direction: 'buy',
        confidence,
        strength: strengthForConfidence(confidence),
        time: last.time,
      };
    }
  } else {
    if (last.close < last.open && last.close < prev.low) {
      const body = Math.abs(last.close - last.open);
      const confidence = clamp01(Math.min(sweep.confidence + body / (atrValue * 2), 1));
      return {
        name: 'liquidity-sweep-reaction',
        direction: 'sell',
        confidence,
        strength: strengthForConfidence(confidence),
        time: last.time,
      };
    }
  }
  return null;
}
