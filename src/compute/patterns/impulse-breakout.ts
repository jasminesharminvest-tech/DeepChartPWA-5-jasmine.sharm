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

// Impulse breakout: candle breaks a recent range with a body larger than ATR.
export function detectImpulseBreakout(candles: Candle[], lookback: number = 20): PatternResult | null {
  if (candles.length < lookback + 1) return null;

  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (atrValue === null || atrValue <= 0) return null;

  const slice = candles.slice(-lookback - 1, -1);
  const rangeHigh = Math.max(...slice.map((c) => c.high));
  const rangeLow = Math.min(...slice.map((c) => c.low));
  const last = candles[candles.length - 1];
  const body = Math.abs(last.close - last.open);

  if (body < atrValue) return null;

  if (last.close > rangeHigh && last.close > last.open) {
    const confidence = clamp01(body / (atrValue * 2));
    return {
      name: 'impulse-breakout',
      direction: 'buy',
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
    };
  }
  if (last.close < rangeLow && last.close < last.open) {
    const confidence = clamp01(body / (atrValue * 2));
    return {
      name: 'impulse-breakout',
      direction: 'sell',
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
    };
  }
  return null;
}
