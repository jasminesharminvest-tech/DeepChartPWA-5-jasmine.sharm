import type { Candle, MarketStructure } from '@/types/domain';

const PIVOT_LOOKUP = 2;

interface Pivot {
  index: number;
  price: number;
  type: 'high' | 'low';
}

function findPivots(candles: Candle[], lookback: number): { highs: Pivot[]; lows: Pivot[] } {
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];

  for (let i = PIVOT_LOOKUP; i < slice.length - PIVOT_LOOKUP; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= PIVOT_LOOKUP; j++) {
      if (slice[i].high <= slice[i - j].high || slice[i].high <= slice[i + j].high) isHigh = false;
      if (slice[i].low >= slice[i - j].low || slice[i].low >= slice[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ index: offset + i, price: slice[i].high, type: 'high' });
    if (isLow) lows.push({ index: offset + i, price: slice[i].low, type: 'low' });
  }
  return { highs, lows };
}

export function computeStructure(candles: Candle[], lookback: number = 50): MarketStructure {
  if (candles.length < PIVOT_LOOKUP * 2 + 3) {
    return { trend: 'range', bos: false, choch: false, swingHigh: null, swingLow: null };
  }

  const slice = candles.slice(-lookback);
  const { highs, lows } = findPivots(candles, lookback);

  const lastCandle = slice[slice.length - 1];
  const prevCandle = slice[slice.length - 2];

  const recentHighs = highs.slice(-3);
  const recentLows = lows.slice(-3);
  const swingHigh = recentHighs.length > 0 ? recentHighs[recentHighs.length - 1].price : Math.max(...slice.map((c) => c.high));
  const swingLow = recentLows.length > 0 ? recentLows[recentLows.length - 1].price : Math.min(...slice.map((c) => c.low));

  let trend: 'up' | 'down' | 'range' = 'range';
  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const higherHighs = recentHighs[recentHighs.length - 1].price > recentHighs[0].price;
    const higherLows = recentLows[recentLows.length - 1].price > recentLows[0].price;
    const lowerHighs = recentHighs[recentHighs.length - 1].price < recentHighs[0].price;
    const lowerLows = recentLows[recentLows.length - 1].price < recentLows[0].price;
    if (higherHighs && higherLows) trend = 'up';
    else if (lowerHighs && lowerLows) trend = 'down';
  } else {
    // Fallback: compare first and last candle slopes
    const first = slice[0];
    const slope = (lastCandle.close - first.close) / Math.max(1, slice.length);
    const atrApprox = Math.abs(lastCandle.high - lastCandle.low);
    if (slope > atrApprox * 0.05) trend = 'up';
    else if (slope < -atrApprox * 0.05) trend = 'down';
  }

  let bos = false;
  let choch = false;

  if (trend === 'up' || trend === 'range') {
    bos = lastCandle.close > swingHigh && prevCandle.close <= swingHigh;
    choch = lastCandle.close < swingLow && prevCandle.close >= swingLow;
  }
  if (trend === 'down') {
    bos = lastCandle.close < swingLow && prevCandle.close >= swingLow;
    choch = lastCandle.close > swingHigh && prevCandle.close <= swingHigh;
  }

  return { trend, bos, choch, swingHigh, swingLow };
}
