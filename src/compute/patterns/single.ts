import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { clamp01 } from '@/compute/indicators/helpers';

const DOJI_BODY_RATIO = 0.01;
const BODY_RATIO_THRESHOLD = 0.6;
const MARUBOZU_BODY_RATIO = 0.9;
const SPINNING_BODY_RATIO = 0.3;

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

export function detectHammer(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range > BODY_RATIO_THRESHOLD) return null;
  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;
  if (lowerWick < body * 2) return null;
  if (upperWick > body * 0.5) return null;
  const isBullish = cur.close > cur.open;
  if (!isBullish) return null;
  const confidence = clamp01(lowerWick / range);
  return {
    name: 'hammer',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

export function detectShootingStar(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range > BODY_RATIO_THRESHOLD) return null;
  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;
  if (upperWick < body * 2) return null;
  if (lowerWick > body * 0.5) return null;
  const isBearish = cur.close < cur.open;
  if (!isBearish) return null;
  const confidence = clamp01(upperWick / range);
  return {
    name: 'shooting-star',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

export function detectDoji(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range >= DOJI_BODY_RATIO) return null;
  const direction = cur.close >= cur.open ? 'buy' : 'sell';
  return {
    name: 'doji',
    direction,
    confidence: 0.3,
    strength: strengthForConfidence(0.3),
    time: cur.time,
  };
}

export function detectInvertedHammer(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range > BODY_RATIO_THRESHOLD) return null;
  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;
  if (upperWick < body * 2) return null;
  if (lowerWick > body * 0.5) return null;
  const isBullish = cur.close > cur.open;
  if (!isBullish) return null;
  const confidence = clamp01(upperWick / range * 0.8);
  return {
    name: 'inverted-hammer',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

export function detectHangingMan(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range > BODY_RATIO_THRESHOLD) return null;
  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;
  if (lowerWick < body * 2) return null;
  if (upperWick > body * 0.5) return null;
  const isBearish = cur.close < cur.open;
  if (!isBearish) return null;
  const confidence = clamp01(lowerWick / range * 0.8);
  return {
    name: 'hanging-man',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

export function detectMarubozuBullish(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range < MARUBOZU_BODY_RATIO) return null;
  if (cur.close <= cur.open) return null;
  const upperWick = cur.high - cur.close;
  const lowerWick = cur.open - cur.low;
  if (upperWick > body * 0.05 || lowerWick > body * 0.05) return null;
  const confidence = clamp01(body / range);
  return {
    name: 'marubozu-bullish',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

export function detectMarubozuBearish(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (body / range < MARUBOZU_BODY_RATIO) return null;
  if (cur.close >= cur.open) return null;
  const upperWick = cur.high - cur.open;
  const lowerWick = cur.close - cur.low;
  if (upperWick > body * 0.05 || lowerWick > body * 0.05) return null;
  const confidence = clamp01(body / range);
  return {
    name: 'marubozu-bearish',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

export function detectSpinningTop(cur: Candle): PatternResult | null {
  const body = Math.abs(cur.close - cur.open);
  const range = cur.high - cur.low || 1e-9;
  if (range <= 0) return null;
  const bodyRatio = body / range;
  if (bodyRatio >= SPINNING_BODY_RATIO) return null;
  if (bodyRatio < DOJI_BODY_RATIO) return null;
  const upperWick = cur.high - Math.max(cur.close, cur.open);
  const lowerWick = Math.min(cur.close, cur.open) - cur.low;
  if (Math.abs(upperWick - lowerWick) > body * 1.5) return null;
  const direction = cur.close >= cur.open ? 'buy' : 'sell';
  const confidence = 0.25;
  return {
    name: 'spinning-top',
    direction,
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}
