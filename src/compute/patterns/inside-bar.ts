import type { Candle, PatternResult, SignalStrength } from '@/types/domain';

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

// Inside bar: current candle fully contained within previous candle's range.
export function detectInsideBar(prev: Candle, cur: Candle): PatternResult | null {
  if (cur.high <= prev.high && cur.low >= prev.low) {
    const prevRange = prev.high - prev.low || 1e-9;
    const curRange = cur.high - cur.low || 1e-9;
    const confidence = Math.max(0.3, Math.min(0.7, 1 - curRange / prevRange));
    const direction = cur.close >= cur.open ? 'buy' : 'sell';
    return {
      name: 'inside-bar',
      direction,
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
    };
  }
  return null;
}
