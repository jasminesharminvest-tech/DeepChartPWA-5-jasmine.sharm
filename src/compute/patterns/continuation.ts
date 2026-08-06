import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { clamp01 } from '@/compute/indicators/helpers';

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

// Rising three methods: strong bullish candle, three small bearish candles contained
// within first candle's range, then another bullish candle that closes above first.
export function detectRisingThreeMethods(candles: Candle[]): PatternResult | null {
  if (candles.length < 5) return null;
  const idx = candles.length - 5;
  const first = candles[idx];
  const last = candles[candles.length - 1];

  if (first.close <= first.open) return null;
  if (last.close <= last.open) return null;
  if (last.close <= first.close) return null;

  for (let i = 1; i <= 3; i++) {
    const c = candles[idx + i];
    if (c.close >= c.open) return null;
    if (c.high > first.high || c.low < first.low) return null;
  }

  const firstBody = Math.abs(first.close - first.open);
  const lastBody = Math.abs(last.close - last.open);
  const confidence = clamp01(0.6 + Math.min(firstBody, lastBody) / (Math.max(firstBody, lastBody) + 1e-9) * 0.2);
  return {
    name: 'rising-three-methods',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: last.time,
  };
}

// Falling three methods: strong bearish candle, three small bullish candles contained
// within first candle's range, then another bearish candle that closes below first.
export function detectFallingThreeMethods(candles: Candle[]): PatternResult | null {
  if (candles.length < 5) return null;
  const idx = candles.length - 5;
  const first = candles[idx];
  const last = candles[candles.length - 1];

  if (first.close >= first.open) return null;
  if (last.close >= last.open) return null;
  if (last.close >= first.close) return null;

  for (let i = 1; i <= 3; i++) {
    const c = candles[idx + i];
    if (c.close <= c.open) return null;
    if (c.high > first.high || c.low < first.low) return null;
  }

  const firstBody = Math.abs(first.close - first.open);
  const lastBody = Math.abs(last.close - last.open);
  const confidence = clamp01(0.6 + Math.min(firstBody, lastBody) / (Math.max(firstBody, lastBody) + 1e-9) * 0.2);
  return {
    name: 'falling-three-methods',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: last.time,
  };
}
