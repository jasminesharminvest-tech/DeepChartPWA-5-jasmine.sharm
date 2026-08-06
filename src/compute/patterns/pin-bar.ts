import type { Candle, PatternResult, SignalStrength } from '@/types/domain';

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Pin bar: body ≤ 1/3 of total candle length, long wick in opposite direction of signal.
export function detectPinBar(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body > range / 3) return null;

  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;

  // Bullish pin bar: long lower wick
  if (lowerWick > range * 0.6 && lowerWick > body * 2) {
    const confidence = clamp01(lowerWick / range);
    return {
      name: 'pin-bar',
      direction: 'buy',
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
    };
  }

  // Bearish pin bar: long upper wick
  if (upperWick > range * 0.6 && upperWick > body * 2) {
    const confidence = clamp01(upperWick / range);
    return {
      name: 'pin-bar',
      direction: 'sell',
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
    };
  }

  return null;
}
