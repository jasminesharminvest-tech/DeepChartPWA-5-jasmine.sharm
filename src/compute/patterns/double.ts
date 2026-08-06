import type { Candle, PatternResult, SignalStrength } from '@/types/domain';
import { clamp01 } from '@/compute/indicators/helpers';

const ENGULFING_THRESHOLD = 1.0;

function strengthForConfidence(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'strong';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

export function detectBullishEngulfing(prev: Candle, cur: Candle, prevVolume = 0): PatternResult | null {
  const prevBody = Math.abs(prev.close - prev.open);
  const curBody = Math.abs(cur.close - cur.open);
  if (prev.close >= prev.open) return null;
  if (cur.close <= cur.open) return null;
  if (curBody < prevBody * ENGULFING_THRESHOLD) return null;
  if (cur.open <= prev.close && cur.close >= prev.open) {
    const ratio = prevBody > 0 ? prevBody / curBody : 1;
    const volumeBoost = prevVolume > 0 && cur.volume > prevVolume * 1.5 ? 0.15 : 0;
    const confidence = clamp01(0.5 + ratio * 0.3 + volumeBoost);
    return {
      name: 'bullish-engulfing',
      direction: 'buy',
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
      volumeConfirmed: volumeBoost > 0,
    };
  }
  return null;
}

export function detectBearishEngulfing(prev: Candle, cur: Candle, prevVolume = 0): PatternResult | null {
  const prevBody = Math.abs(prev.close - prev.open);
  const curBody = Math.abs(cur.close - cur.open);
  if (prev.close <= prev.open) return null;
  if (cur.close >= cur.open) return null;
  if (curBody < prevBody * ENGULFING_THRESHOLD) return null;
  if (cur.open >= prev.close && cur.close <= prev.open) {
    const ratio = prevBody > 0 ? prevBody / curBody : 1;
    const volumeBoost = prevVolume > 0 && cur.volume > prevVolume * 1.5 ? 0.15 : 0;
    const confidence = clamp01(0.5 + ratio * 0.3 + volumeBoost);
    return {
      name: 'bearish-engulfing',
      direction: 'sell',
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
      volumeConfirmed: volumeBoost > 0,
    };
  }
  return null;
}

export function detectBullishHarami(prev: Candle, cur: Candle): PatternResult | null {
  const prevBody = Math.abs(prev.close - prev.open);
  const curBody = Math.abs(cur.close - cur.open);
  if (prev.close >= prev.open) return null;
  if (cur.close <= cur.open) return null;
  if (curBody >= prevBody) return null;
  if (cur.open >= prev.close && cur.close <= prev.open) {
    const confidence = clamp01(0.4 + (1 - curBody / prevBody) * 0.2);
    return {
      name: 'bullish-harami',
      direction: 'buy',
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
    };
  }
  return null;
}

export function detectBearishHarami(prev: Candle, cur: Candle): PatternResult | null {
  const prevBody = Math.abs(prev.close - prev.open);
  const curBody = Math.abs(cur.close - cur.open);
  if (prev.close <= prev.open) return null;
  if (cur.close >= cur.open) return null;
  if (curBody >= prevBody) return null;
  if (cur.open <= prev.close && cur.close >= prev.open) {
    const confidence = clamp01(0.4 + (1 - curBody / prevBody) * 0.2);
    return {
      name: 'bearish-harami',
      direction: 'sell',
      confidence,
      strength: strengthForConfidence(confidence),
      time: cur.time,
    };
  }
  return null;
}

// Piercing line: bearish candle followed by bullish candle that opens below prior low
// but closes above prior midpoint.
export function detectPiercingLine(prev: Candle, cur: Candle): PatternResult | null {
  if (prev.close >= prev.open) return null;
  if (cur.close <= cur.open) return null;
  if (cur.open >= prev.low) return null;
  const midpoint = (prev.open + prev.close) / 2;
  if (cur.close <= midpoint) return null;
  if (cur.close >= prev.open) return null;
  const prevBody = Math.abs(prev.close - prev.open);
  const penetration = (cur.close - midpoint) / (prevBody / 2 + 1e-9);
  const confidence = clamp01(0.5 + penetration * 0.2);
  return {
    name: 'piercing-line',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

// Dark cloud cover: bullish candle followed by bearish candle that opens above prior high
// but closes below prior midpoint.
export function detectDarkCloudCover(prev: Candle, cur: Candle): PatternResult | null {
  if (prev.close <= prev.open) return null;
  if (cur.close >= cur.open) return null;
  if (cur.open <= prev.high) return null;
  const midpoint = (prev.open + prev.close) / 2;
  if (cur.close >= midpoint) return null;
  if (cur.close <= prev.open) return null;
  const prevBody = Math.abs(prev.close - prev.open);
  const penetration = (midpoint - cur.close) / (prevBody / 2 + 1e-9);
  const confidence = clamp01(0.5 + penetration * 0.2);
  return {
    name: 'dark-cloud-cover',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

const TWEEZER_TOLERANCE = 0.001;

// Tweezer bottom: two consecutive candles with matching lows after a downtrend.
export function detectTweezerBottom(prev: Candle, cur: Candle): PatternResult | null {
  const tolerance = Math.max(prev.low, cur.low) * TWEEZER_TOLERANCE;
  if (Math.abs(prev.low - cur.low) > tolerance) return null;
  if (cur.close <= cur.open) return null;
  const confidence = clamp01(0.55);
  return {
    name: 'tweezer-bottom',
    direction: 'buy',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}

// Tweezer top: two consecutive candles with matching highs after an uptrend.
export function detectTweezerTop(prev: Candle, cur: Candle): PatternResult | null {
  const tolerance = Math.max(prev.high, cur.high) * TWEEZER_TOLERANCE;
  if (Math.abs(prev.high - cur.high) > tolerance) return null;
  if (cur.close >= cur.open) return null;
  const confidence = clamp01(0.55);
  return {
    name: 'tweezer-top',
    direction: 'sell',
    confidence,
    strength: strengthForConfidence(confidence),
    time: cur.time,
  };
}
