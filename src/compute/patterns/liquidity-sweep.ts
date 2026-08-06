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

// Liquidity sweep: price spikes beyond a recent extreme then reverses.
export function detectLiquiditySweep(candles: Candle[], lookback: number = 20): PatternResult | null {
  if (candles.length < lookback + 1) return null;

  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (atrValue === null || atrValue <= 0) return null;

  const slice = candles.slice(-lookback - 1, -1);
  const recentHigh = Math.max(...slice.map((c) => c.high));
  const recentLow = Math.min(...slice.map((c) => c.low));
  const last = candles[candles.length - 1];

  // Bullish sweep: spikes below recent low then closes back above it
  if (last.low < recentLow && last.close > recentLow) {
    const wickDepth = recentLow - last.low;
    const confidence = clamp01(wickDepth / atrValue);
    return {
      name: 'liquidity-sweep',
      direction: 'buy',
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
    };
  }

  // Bearish sweep: spikes above recent high then closes back below it
  if (last.high > recentHigh && last.close < recentHigh) {
    const wickHeight = last.high - recentHigh;
    const confidence = clamp01(wickHeight / atrValue);
    return {
      name: 'liquidity-sweep',
      direction: 'sell',
      confidence,
      strength: strengthForConfidence(confidence),
      time: last.time,
    };
  }
  return null;
}
