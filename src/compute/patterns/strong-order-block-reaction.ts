import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { superOrderBlocks } from '@/compute/indicators/super-order-block';

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Strong order block reaction: price returns to an unmitigated order block and reacts.
export function detectStrongOrderBlockReaction(candles: Candle[]): PatternResult | null {
  if (candles.length < 10) return null;

  const blocks = superOrderBlocks(candles);
  const activeBlocks = blocks.filter((b) => !b.mitigated && !b.breaker);
  if (activeBlocks.length === 0) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  for (const block of activeBlocks) {
    if (block.direction === 'bullish') {
      // Price entered bullish OB zone and bounced
      if (prev.low <= block.high && last.close > block.high) {
        const confidence = clamp01((block.high - block.low) / (last.high - last.low + 1e-9));
        return {
          name: 'strong-order-block-reaction',
          direction: 'buy',
          confidence: Math.max(0.5, confidence),
          strength: strengthForConfidence(confidence),
          time: last.time,
        };
      }
    } else {
      if (prev.high >= block.low && last.close < block.low) {
        const confidence = clamp01((block.high - block.low) / (last.high - last.low + 1e-9));
        return {
          name: 'strong-order-block-reaction',
          direction: 'sell',
          confidence: Math.max(0.5, confidence),
          strength: strengthForConfidence(confidence),
          time: last.time,
        };
      }
    }
  }
  return null;
}
