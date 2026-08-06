import type { Candle, PatternResult, FeatureName, IndicatorSnapshot } from '@/types/domain';
import { rsi as calcRsi } from '@/compute/indicators/rsi';
import { detectHammer, detectShootingStar, detectDoji, detectInvertedHammer, detectHangingMan, detectMarubozuBullish, detectMarubozuBearish, detectSpinningTop } from './single';
import {
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectBullishHarami,
  detectBearishHarami,
  detectPiercingLine,
  detectDarkCloudCover,
  detectTweezerBottom,
  detectTweezerTop,
} from './double';
import {
  detectMorningStar,
  detectEveningStar,
  detectThreeWhiteSoldiers,
  detectThreeBlackCrows,
  detectAbandonedBabyBottom,
  detectAbandonedBabyTop,
} from './triple';
import { detectRisingThreeMethods, detectFallingThreeMethods } from './continuation';
import { detectPinBar } from './pin-bar';
import { detectInsideBar } from './inside-bar';
import { detectImpulseBreakout } from './impulse-breakout';
import { detectConsolidationBreakout } from './consolidation-breakout';
import { detectLiquiditySweep } from './liquidity-sweep';
import { detectLiquiditySweepReaction } from './liquidity-sweep-reaction';
import { detectMeanReversion } from './mean-reversion';
import { detectStrongOrderBlockReaction } from './strong-order-block-reaction';
import { detectLevelReaction } from './level-reaction';

const PATTERN_CONFIDENCE_HIERARCHY: Record<string, number> = {
  'bullish-engulfing': 0.85,
  'bearish-engulfing': 0.85,
  'morning-star': 0.8,
  'evening-star': 0.8,
  'three-white-soldiers': 0.8,
  'three-black-crows': 0.8,
  'abandoned-baby-bottom': 0.9,
  'abandoned-baby-top': 0.9,
  'pin-bar': 0.7,
  'hammer': 0.6,
  'shooting-star': 0.6,
  'inverted-hammer': 0.55,
  'hanging-man': 0.55,
  'piercing-line': 0.65,
  'dark-cloud-cover': 0.65,
  'tweezer-bottom': 0.6,
  'tweezer-top': 0.6,
  'bullish-harami': 0.5,
  'bearish-harami': 0.5,
  'inside-bar': 0.4,
  'doji': 0.3,
  'spinning-top': 0.25,
  'marubozu-bullish': 0.65,
  'marubozu-bearish': 0.65,
  'rising-three-methods': 0.7,
  'falling-three-methods': 0.7,
  'impulse-breakout': 0.7,
  'consolidation-breakout': 0.65,
  'liquidity-sweep': 0.7,
  'liquidity-sweep-reaction': 0.75,
  'mean-reversion': 0.6,
  'strong-order-block-reaction': 0.7,
  'level-reaction': 0.55,
};

export function applyConfidenceHierarchy(p: PatternResult): PatternResult {
  const baseConfidence = PATTERN_CONFIDENCE_HIERARCHY[p.name] ?? p.confidence;
  const volumeBonus = p.volumeConfirmed ? 0.1 : 0;
  const confidence = Math.min(1, Math.max(p.confidence, baseConfidence) + volumeBonus);
  const strength: PatternResult['strength'] =
    confidence >= 0.75 ? 'strong' : confidence >= 0.5 ? 'moderate' : 'weak';
  return { ...p, confidence, strength };
}

export function detectAllPatterns(
  candles: Candle[],
  activeFeatures: FeatureName[],
  snapshot?: IndicatorSnapshot,
): PatternResult[] {
  if (candles.length < 2) return [];

  const has = (name: FeatureName) => activeFeatures.length === 0 || activeFeatures.includes(name);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prevVolume = prev.volume;
  const raw: PatternResult[] = [];

  // Single-bar patterns
  if (has('hammer')) { const p = detectHammer(last); if (p) raw.push(p); }
  if (has('shooting-star')) { const p = detectShootingStar(last); if (p) raw.push(p); }
  if (has('doji')) { const p = detectDoji(last); if (p) raw.push(p); }
  if (has('pin-bar')) { const p = detectPinBar(last); if (p) raw.push(p); }
  if (has('marubozu-bullish')) { const p = detectMarubozuBullish(last); if (p) raw.push(p); }
  if (has('marubozu-bearish')) { const p = detectMarubozuBearish(last); if (p) raw.push(p); }
  if (has('spinning-top')) { const p = detectSpinningTop(last); if (p) raw.push(p); }
  if (has('inverted-hammer')) { const p = detectInvertedHammer(last); if (p) raw.push(p); }
  if (has('hanging-man')) { const p = detectHangingMan(last); if (p) raw.push(p); }

  // Double-bar patterns
  if (has('bullish-engulfing')) { const p = detectBullishEngulfing(prev, last, prevVolume); if (p) raw.push(p); }
  if (has('bearish-engulfing')) { const p = detectBearishEngulfing(prev, last, prevVolume); if (p) raw.push(p); }
  if (has('bullish-harami')) { const p = detectBullishHarami(prev, last); if (p) raw.push(p); }
  if (has('bearish-harami')) { const p = detectBearishHarami(prev, last); if (p) raw.push(p); }
  if (has('inside-bar')) { const p = detectInsideBar(prev, last); if (p) raw.push(p); }
  if (has('piercing-line')) { const p = detectPiercingLine(prev, last); if (p) raw.push(p); }
  if (has('dark-cloud-cover')) { const p = detectDarkCloudCover(prev, last); if (p) raw.push(p); }
  if (has('tweezer-bottom')) { const p = detectTweezerBottom(prev, last); if (p) raw.push(p); }
  if (has('tweezer-top')) { const p = detectTweezerTop(prev, last); if (p) raw.push(p); }

  // Triple-bar patterns
  if (has('morning-star')) { const p = detectMorningStar(candles); if (p) raw.push(p); }
  if (has('evening-star')) { const p = detectEveningStar(candles); if (p) raw.push(p); }
  if (has('three-white-soldiers')) { const p = detectThreeWhiteSoldiers(candles); if (p) raw.push(p); }
  if (has('three-black-crows')) { const p = detectThreeBlackCrows(candles); if (p) raw.push(p); }
  if (has('abandoned-baby-bottom')) { const p = detectAbandonedBabyBottom(candles); if (p) raw.push(p); }
  if (has('abandoned-baby-top')) { const p = detectAbandonedBabyTop(candles); if (p) raw.push(p); }

  // Continuation patterns
  if (has('rising-three-methods')) { const p = detectRisingThreeMethods(candles); if (p) raw.push(p); }
  if (has('falling-three-methods')) { const p = detectFallingThreeMethods(candles); if (p) raw.push(p); }

  // SMC / structure patterns
  if (has('impulse-breakout')) { const p = detectImpulseBreakout(candles); if (p) raw.push(p); }
  if (has('consolidation-breakout')) { const p = detectConsolidationBreakout(candles); if (p) raw.push(p); }
  if (has('liquidity-sweep')) { const p = detectLiquiditySweep(candles); if (p) raw.push(p); }
  if (has('liquidity-sweep-reaction')) { const p = detectLiquiditySweepReaction(candles); if (p) raw.push(p); }
  if (has('mean-reversion') && snapshot) {
    const rsiShortArr = calcRsi(candles.map((c) => c.close), 7);
    const rsiShort = rsiShortArr[rsiShortArr.length - 1];
    const p = detectMeanReversion(candles, snapshot, rsiShort);
    if (p) raw.push(p);
  }
  if (has('strong-order-block-reaction')) { const p = detectStrongOrderBlockReaction(candles); if (p) raw.push(p); }
  if (has('level-reaction')) { const p = detectLevelReaction(candles); if (p) raw.push(p); }

  return raw.map(applyConfidenceHierarchy);
}

export function detectPatterns(candles: Candle[]): PatternResult[] {
  return detectAllPatterns(candles, [] as FeatureName[], undefined);
}

export function patternDirection(name: PatternResult['name']): 'buy' | 'sell' {
  if (name === 'bullish-engulfing' || name === 'hammer' || name === 'morning-star' || name === 'bullish-harami' ||
      name === 'three-white-soldiers' || name === 'abandoned-baby-bottom' || name === 'piercing-line' ||
      name === 'tweezer-bottom' || name === 'inverted-hammer' || name === 'marubozu-bullish' ||
      name === 'rising-three-methods') return 'buy';
  if (name === 'bearish-engulfing' || name === 'shooting-star' || name === 'evening-star' || name === 'bearish-harami' ||
      name === 'three-black-crows' || name === 'abandoned-baby-top' || name === 'dark-cloud-cover' ||
      name === 'tweezer-top' || name === 'hanging-man' || name === 'marubozu-bearish' ||
      name === 'falling-three-methods') return 'sell';
  return 'buy';
}
