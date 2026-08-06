import type { Candle } from '@/types/domain';

export interface OrderBlockZone {
  open: number;
  close: number;
  high: number;
  low: number;
  direction: 'bullish' | 'bearish';
  mitigated: boolean;
  filled: boolean;
  time: number;
  endTime: number;
}

// Order block with mitigation tracking and FVG fill detection.
// After first return to the zone, block is "mitigated" (weakened).
// After FVG fill (price covers the gap), zone is no longer active.
export function orderBlockStrength(candles: Candle[], lookback: number = 50): OrderBlockZone[] {
  if (candles.length < 5) return [];

  const slice = candles.slice(-lookback);
  const lastTime = slice[slice.length - 1].time;
  const zones: OrderBlockZone[] = [];

  for (let i = 1; i < slice.length - 1; i++) {
    const cur = slice[i];
    const next = slice[i + 1];

    // Bullish order block: last bearish candle before bullish move
    if (cur.close < cur.open && next.close > cur.open) {
      const fvg = detectFVG(slice, i);
      const mitigated = slice.slice(i + 2).some((c) => c.low <= cur.high);
      const filled = fvg !== null && slice.slice(i + 2).some((c) => c.low <= fvg.lower);
      zones.push({
        open: cur.open, close: cur.close, high: cur.high, low: cur.low,
        direction: 'bullish', mitigated, filled,
        time: cur.time, endTime: lastTime,
      });
    }

    // Bearish order block: last bullish candle before bearish move
    if (cur.close > cur.open && next.close < cur.open) {
      const fvg = detectFVG(slice, i);
      const mitigated = slice.slice(i + 2).some((c) => c.high >= cur.low);
      const filled = fvg !== null && slice.slice(i + 2).some((c) => c.high >= fvg.upper);
      zones.push({
        open: cur.open, close: cur.close, high: cur.high, low: cur.low,
        direction: 'bearish', mitigated, filled,
        time: cur.time, endTime: lastTime,
      });
    }
  }

  return zones.filter((z) => !z.filled);
}

export interface ImbalanceZone {
  upper: number;
  lower: number;
  direction: 'bullish' | 'bearish';
  filled: boolean;
  time: number;
  endTime: number;
}

// Fair value gap (imbalance) detection: three-candle gap between candle A high/low and candle C.
export function detectImbalances(candles: Candle[], lookback: number = 50): ImbalanceZone[] {
  if (candles.length < 3) return [];

  const slice = candles.slice(-lookback);
  const lastTime = slice[slice.length - 1].time;
  const zones: ImbalanceZone[] = [];

  for (let i = 0; i < slice.length - 2; i++) {
    const a = slice[i];
    const c = slice[i + 2];
    const startTime = slice[i + 1].time;

    // Bullish FVG: candle C low > candle A high
    if (c.low > a.high) {
      const filled = slice.slice(i + 3).some((cd) => cd.low <= a.high);
      zones.push({ upper: c.low, lower: a.high, direction: 'bullish', filled, time: startTime, endTime: lastTime });
    }

    // Bearish FVG: candle C high < candle A low
    if (c.high < a.low) {
      const filled = slice.slice(i + 3).some((cd) => cd.high >= a.low);
      zones.push({ upper: a.low, lower: c.high, direction: 'bearish', filled, time: startTime, endTime: lastTime });
    }
  }

  return zones.filter((z) => !z.filled);
}

interface FVG {
  upper: number;
  lower: number;
}

function detectFVG(candles: Candle[], idx: number): FVG | null {
  if (idx + 2 >= candles.length) return null;
  const a = candles[idx];
  const c = candles[idx + 2];

  // Bullish FVG: candle[idx+2].low > candle[idx].high
  if (c.low > a.high) {
    return { upper: c.low, lower: a.high };
  }
  // Bearish FVG: candle[idx+2].high < candle[idx].low
  if (c.high < a.low) {
    return { upper: a.low, lower: c.high };
  }
  return null;
}
