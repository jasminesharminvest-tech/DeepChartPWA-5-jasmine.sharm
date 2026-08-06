import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { clamp01 } from '@/compute/indicators/helpers';
import { checkPriorTrend } from './trend-utils';

const MIN_TREND_CANDLES = 5;

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

// Morning star: bearish candle -> small body (star) -> bullish candle closing above first's midpoint.
// Requires preceding downtrend of 5+ candles.
export function detectMorningStar(candles: Candle[]): PatternResult | null {
  if (candles.length < MIN_TREND_CANDLES + 2) return null;
  const idx = candles.length - 3;
  const a = candles[idx];
  const b = candles[idx + 1];
  const c = candles[idx + 2];

  if (!checkPriorTrend(candles.slice(0, idx + 1), 'down', MIN_TREND_CANDLES)) return null;

  const aBody = Math.abs(a.close - a.open);
  const bBody = Math.abs(b.close - b.open);
  const cBody = Math.abs(c.close - c.open);

  if (a.close >= a.open) return null;
  if (bBody > aBody * 0.5) return null;
  if (c.close <= c.open) return null;
  const midpoint = (a.open + a.close) / 2;
  if (c.close <= midpoint) return null;

  const confidence = Math.min(1, cBody / (aBody + 1e-9));
  return {
    name: 'morning-star',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: c.time,
  };
}

// Evening star: bullish candle -> small body (star) -> bearish candle closing below first's midpoint.
// Requires preceding uptrend of 5+ candles.
export function detectEveningStar(candles: Candle[]): PatternResult | null {
  if (candles.length < MIN_TREND_CANDLES + 2) return null;
  const idx = candles.length - 3;
  const a = candles[idx];
  const b = candles[idx + 1];
  const c = candles[idx + 2];

  if (!checkPriorTrend(candles.slice(0, idx + 1), 'up', MIN_TREND_CANDLES)) return null;

  const aBody = Math.abs(a.close - a.open);
  const bBody = Math.abs(b.close - b.open);
  const cBody = Math.abs(c.close - c.open);

  if (a.close <= a.open) return null;
  if (bBody > aBody * 0.5) return null;
  if (c.close >= c.open) return null;
  const midpoint = (a.open + a.close) / 2;
  if (c.close >= midpoint) return null;

  const confidence = Math.min(1, cBody / (aBody + 1e-9));
  return {
    name: 'evening-star',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: c.time,
  };
}

// Three white soldiers: three consecutive bullish candles, each closing higher,
// each opening within the prior body. Requires preceding downtrend.
export function detectThreeWhiteSoldiers(candles: Candle[]): PatternResult | null {
  if (candles.length < MIN_TREND_CANDLES + 2) return null;
  const idx = candles.length - 3;
  const a = candles[idx];
  const b = candles[idx + 1];
  const c = candles[idx + 2];

  if (!checkPriorTrend(candles.slice(0, idx + 1), 'down', MIN_TREND_CANDLES)) return null;

  if (a.close <= a.open) return null;
  if (b.close <= b.open) return null;
  if (c.close <= c.open) return null;
  if (b.close <= a.close) return null;
  if (c.close <= b.close) return null;
  if (b.open < a.open || b.open > a.close) return null;
  if (c.open < b.open || c.open > b.close) return null;

  const avgBody = (Math.abs(a.close - a.open) + Math.abs(b.close - b.open) + Math.abs(c.close - c.open)) / 3;
  const range = (candles[candles.length - 1].high - candles[candles.length - 1].low) || 1e-9;
  const confidence = clamp01(0.6 + avgBody / range * 0.2);
  return {
    name: 'three-white-soldiers',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: c.time,
  };
}

// Three black crows: three consecutive bearish candles, each closing lower,
// each opening within the prior body. Requires preceding uptrend.
export function detectThreeBlackCrows(candles: Candle[]): PatternResult | null {
  if (candles.length < MIN_TREND_CANDLES + 2) return null;
  const idx = candles.length - 3;
  const a = candles[idx];
  const b = candles[idx + 1];
  const c = candles[idx + 2];

  if (!checkPriorTrend(candles.slice(0, idx + 1), 'up', MIN_TREND_CANDLES)) return null;

  if (a.close >= a.open) return null;
  if (b.close >= b.open) return null;
  if (c.close >= c.open) return null;
  if (b.close >= a.close) return null;
  if (c.close >= b.close) return null;
  if (b.open > a.open || b.open < a.close) return null;
  if (c.open > b.open || c.open < b.close) return null;

  const avgBody = (Math.abs(a.close - a.open) + Math.abs(b.close - b.open) + Math.abs(c.close - c.open)) / 3;
  const range = (candles[candles.length - 1].high - candles[candles.length - 1].low) || 1e-9;
  const confidence = clamp01(0.6 + avgBody / range * 0.2);
  return {
    name: 'three-black-crows',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: c.time,
  };
}

// Abandoned baby bottom: downtrend -> bearish candle -> doji gap -> bullish candle gap up.
export function detectAbandonedBabyBottom(candles: Candle[]): PatternResult | null {
  if (candles.length < MIN_TREND_CANDLES + 2) return null;
  const idx = candles.length - 3;
  const a = candles[idx];
  const b = candles[idx + 1];
  const c = candles[idx + 2];

  if (!checkPriorTrend(candles.slice(0, idx + 1), 'down', MIN_TREND_CANDLES)) return null;

  if (a.close >= a.open) return null;
  const bBody = Math.abs(b.close - b.open);
  const bRange = b.high - b.low || 1e-9;
  if (bBody / bRange >= 0.01) return null;
  if (b.high >= a.low) return null;
  if (c.close <= c.open) return null;
  if (c.open <= b.high) return null;

  const confidence = clamp01(0.8);
  return {
    name: 'abandoned-baby-bottom',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: c.time,
  };
}

// Abandoned baby top: uptrend -> bullish candle -> doji gap -> bearish candle gap down.
export function detectAbandonedBabyTop(candles: Candle[]): PatternResult | null {
  if (candles.length < MIN_TREND_CANDLES + 2) return null;
  const idx = candles.length - 3;
  const a = candles[idx];
  const b = candles[idx + 1];
  const c = candles[idx + 2];

  if (!checkPriorTrend(candles.slice(0, idx + 1), 'up', MIN_TREND_CANDLES)) return null;

  if (a.close <= a.open) return null;
  const bBody = Math.abs(b.close - b.open);
  const bRange = b.high - b.low || 1e-9;
  if (bBody / bRange >= 0.01) return null;
  if (b.low <= a.high) return null;
  if (c.close >= c.open) return null;
  if (c.open >= b.low) return null;

  const confidence = clamp01(0.8);
  return {
    name: 'abandoned-baby-top',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: c.time,
  };
}
