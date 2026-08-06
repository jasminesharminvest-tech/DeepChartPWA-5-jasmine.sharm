import type { Candle, PatternResult, SignalStrength, IndicatorSnapshot } from '@/types/domain';
import { computeStructure } from '@/compute/indicators/trend-structure';

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Mean reversion: close beyond BB + RSI(7) in extreme zone (>75/<25) + first reversal bar.
// CRITICAL: if SMC-confirmed trend (BOS) exists in the same direction as the price move,
// SMC takes priority — mean reversion is suppressed or weight reduced to 0.
export function detectMeanReversion(
  candles: Candle[],
  snapshot: IndicatorSnapshot,
  rsiShort: number | null,
): PatternResult | null {
  if (candles.length < 5) return null;
  if (snapshot.bollingerUpper === null || snapshot.bollingerLower === null) return null;
  if (snapshot.bollingerMiddle === null) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const entryPrice = last.close;

  // SMC trend priority: if BOS in same direction as price move, suppress mean reversion
  const structure = computeStructure(candles);
  if (structure.bos) {
    if (structure.trend === 'up' && entryPrice > snapshot.bollingerUpper) return null;
    if (structure.trend === 'down' && entryPrice < snapshot.bollingerLower) return null;
  }

  // Bullish mean reversion: close was below lower BB, now reverses back inside
  if (prev.close < snapshot.bollingerLower && last.close > snapshot.bollingerLower) {
    if (rsiShort !== null && rsiShort < 25) {
      const confidence = clamp01((snapshot.bollingerLower - prev.close) / (snapshot.bollingerUpper - snapshot.bollingerLower + 1e-9));
      return {
        name: 'mean-reversion',
        direction: 'buy',
        confidence: Math.max(0.5, confidence),
        strength: strengthForConfidence(confidence),
        time: last.time,
      };
    }
  }

  // Bearish mean reversion: close was above upper BB, now reverses back inside
  if (prev.close > snapshot.bollingerUpper && last.close < snapshot.bollingerUpper) {
    if (rsiShort !== null && rsiShort > 75) {
      const confidence = clamp01((prev.close - snapshot.bollingerUpper) / (snapshot.bollingerUpper - snapshot.bollingerLower + 1e-9));
      return {
        name: 'mean-reversion',
        direction: 'sell',
        confidence: Math.max(0.5, confidence),
        strength: strengthForConfidence(confidence),
        time: last.time,
      };
    }
  }
  return null;
}
