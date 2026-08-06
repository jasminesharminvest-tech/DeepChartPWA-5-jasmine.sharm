import type { Candle } from '@/types/domain';

export interface SuperOrderBlock {
  open: number;
  close: number;
  high: number;
  low: number;
  direction: 'bullish' | 'bearish';
  mitigated: boolean;
  breaker: boolean;
}

export function superOrderBlocks(candles: Candle[], lookback: number = 100): SuperOrderBlock[] {
  if (candles.length < 10) return [];

  const slice = candles.slice(-lookback);
  const blocks: SuperOrderBlock[] = [];

  for (let i = 2; i < slice.length - 1; i++) {
    const prev = slice[i - 1];
    const cur = slice[i];
    const next = slice[i + 1];

    const isBullishOB =
      cur.close < cur.open &&
      next.close > cur.open &&
      next.close > prev.high;

    const isBearishOB =
      cur.close > cur.open &&
      next.close < cur.open &&
      next.close < prev.low;

    if (isBullishOB) {
      const mitigated = slice.slice(i + 2).some((c) => c.low <= cur.low);
      const breaker = mitigated && slice.slice(i + 2).some((c) => c.close > cur.high);
      blocks.push({
        open: cur.open, close: cur.close, high: cur.high, low: cur.low,
        direction: 'bullish', mitigated, breaker,
      });
    }
    if (isBearishOB) {
      const mitigated = slice.slice(i + 2).some((c) => c.high >= cur.high);
      const breaker = mitigated && slice.slice(i + 2).some((c) => c.close < cur.low);
      blocks.push({
        open: cur.open, close: cur.close, high: cur.high, low: cur.low,
        direction: 'bearish', mitigated, breaker,
      });
    }
  }
  return blocks;
}
