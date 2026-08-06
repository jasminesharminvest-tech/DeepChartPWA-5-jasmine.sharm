import type { Candle } from '@/types/domain';
import { lastNonNull } from './helpers';

export function vwap(candles: Candle[], period?: number): (number | null)[] {
  if (candles.length === 0) return [];
  const slice = period ? candles.slice(-period) : candles;
  const offset = period ? candles.length - slice.length : 0;
  const result: (number | null)[] = Array.from({ length: candles.length }, () => null);

  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (c.volume > 0) {
      const typical = (c.high + c.low + c.close) / 3;
      cumPV += typical * c.volume;
      cumV += c.volume;
      result[offset + i] = cumV > 0 ? cumPV / cumV : null;
    }
  }
  return result;
}

export function vwapLast(candles: Candle[], period?: number): number | null {
  return lastNonNull(vwap(candles, period));
}
