import type {
  Candle,
  IndicatorConfig,
  PatternResult,
  Signal,
  SignalDirection,
  SignalStrength,
  Snapshot,
  Timeframe,
  FeatureName,
  Tick,
} from '@/types/domain';
import type { CalibrationModel } from './calibration-model';
import { estimateTradeLevels, fallbackAtr } from './trade-levels';
import { recommendedExpiry } from './recommended-expiry';
import { estimateSpread } from './spread-estimate';
import { computeDirectionScore } from './direction-prediction';
import { applySignalFilters } from './signal-filters';

const DEFAULT_SCORE_THRESHOLD = 2;
const REVISION_DELTA_THRESHOLD = 3.0;

export const FEATURE_KEYS = [
  'rsi', 'ema_cross', 'macd_hist', 'bb_width', 'atr',
  'vwap', 'impulse_vel', 'regime_trend', 'regime_vol',
  'bos', 'choch', 'pattern_conf',
] as const;

export const FEATURE_COUNT = FEATURE_KEYS.length;

export interface FeatureVector {
  values: number[];
  keys: string[];
}

export function buildFeatureVector(snapshot: Snapshot): FeatureVector {
  const ind = snapshot.indicators;
  const map = new Map<string, number>();

  if (ind.rsi !== null) map.set('rsi', ind.rsi / 100);
  if (ind.emaFast !== null && ind.emaSlow !== null) {
    map.set('ema_cross', ind.emaSlow !== 0 ? (ind.emaFast - ind.emaSlow) / ind.emaSlow : 0);
  }
  if (ind.macdHistogram !== null) map.set('macd_hist', ind.macdHistogram);
  if (ind.bollingerUpper !== null && ind.bollingerLower !== null) {
    const width = ind.bollingerUpper - ind.bollingerLower;
    map.set('bb_width', width !== 0 ? width / (ind.bollingerMiddle ?? 1) : 0);
  }
  if (ind.atr !== null) map.set('atr', ind.atr);
  if (ind.vwap !== null) map.set('vwap', ind.vwap);
  if (ind.impulseVelocity !== null) map.set('impulse_vel', ind.impulseVelocity);
  if (snapshot.regime === 'trend') map.set('regime_trend', 1);
  if (snapshot.regime === 'high-volatility') map.set('regime_vol', 1);
  if (snapshot.structure.bos) map.set('bos', 1);
  if (snapshot.structure.choch) map.set('choch', 1);

  const patterns = snapshot.patterns;
  if (patterns.length > 0) {
    const topPattern = patterns[patterns.length - 1];
    map.set('pattern_conf', topPattern.confidence * (topPattern.direction === 'buy' ? 1 : -1));
  }

  const values = FEATURE_KEYS.map((k) => map.get(k) ?? 0);
  return { values, keys: [...FEATURE_KEYS] };
}

function strengthFor(score: number): SignalStrength {
  if (score >= 4) return 'strong';
  if (score >= 3) return 'moderate';
  return 'weak';
}

interface EvidenceResult {
  direction: SignalDirection;
  score: number;
  reasons: string[];
  pattern: PatternResult | null;
}

const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;

function evaluateEvidence(
  candles: Candle[],
  snapshot: Snapshot,
  entryPrice: number,
): EvidenceResult {
  const ind = snapshot.indicators;
  const { direction, score: dirScore, reasons: dirReasons } = computeDirectionScore(candles, snapshot);

  const patterns = snapshot.patterns;
  const topPattern = patterns.length > 0 ? patterns[patterns.length - 1] : null;

  // Collect additional indicator evidence for the score
  const extraReasons: string[] = [];
  let indicatorBonus = 0;

  if (ind.rsi !== null) {
    if (ind.rsi < RSI_OVERSOLD && direction === 'buy') { indicatorBonus += 0.5; extraReasons.push(`RSI oversold (${ind.rsi.toFixed(1)})`); }
    else if (ind.rsi > RSI_OVERBOUGHT && direction === 'sell') { indicatorBonus += 0.5; extraReasons.push(`RSI overbought (${ind.rsi.toFixed(1)})`); }
  }

  if (ind.bollingerLower !== null && ind.bollingerUpper !== null) {
    if (entryPrice <= ind.bollingerLower && direction === 'buy') { indicatorBonus += 0.5; extraReasons.push('Price at lower Bollinger band'); }
    else if (entryPrice >= ind.bollingerUpper && direction === 'sell') { indicatorBonus += 0.5; extraReasons.push('Price at upper Bollinger band'); }
  }

  // Apply false-signal filters
  const filterResult = applySignalFilters(candles, snapshot, direction, dirScore);
  const filteredScore = (dirScore + indicatorBonus) * filterResult.scoreMultiplier;

  if (filterResult.invalidated) {
    return { direction, score: 0, reasons: [...dirReasons, ...filterResult.reasons], pattern: topPattern };
  }

  const allReasons = [...dirReasons, ...extraReasons, ...filterResult.reasons];

  return { direction, score: filteredScore, reasons: allReasons, pattern: topPattern };
}

export function sigmoidFallback(score: number): number {
  return 1 / (1 + Math.exp(-score / 5));
}

export interface BuildSignalParams {
  symbolId: string;
  timeframe: Timeframe;
  candles: Candle[];
  config: IndicatorConfig;
  atrMultiplier: number;
  activeFeatures: FeatureName[];
  snapshot: Snapshot;
  calibration: CalibrationModel | null;
  tick: Tick | null;
  barsToResolve: number;
  scoreThreshold?: number;
}

export function buildSignal(params: BuildSignalParams): Signal | null {
  const { symbolId, timeframe, candles, config, atrMultiplier, snapshot, calibration, tick, barsToResolve, scoreThreshold } = params;

  const warmup = Math.max(config.emaSlow, config.bbPeriod, config.macdSlow, config.rsiPeriod, config.atrPeriod) + 5;
  if (candles.length < warmup) return null;

  const lastCandle = candles[candles.length - 1];
  const entryPrice = lastCandle.close;
  const evidence = evaluateEvidence(candles, snapshot, entryPrice);
  const threshold = scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  if (evidence.score < threshold) return null;

  const atrValue = fallbackAtr(snapshot.indicators, candles, config.atrPeriod);
  if (atrValue <= 0) return null;

  const levels = estimateTradeLevels(entryPrice, atrValue, atrMultiplier, evidence.direction);
  if (!levels) return null;
  const featureVec = buildFeatureVector(snapshot);
  const spreadInfo = estimateSpread(symbolId, tick);
  const expiry = recommendedExpiry(timeframe, atrValue, entryPrice);

  let calibratedProbability: number | null;
  if (calibration && calibration.isReady()) {
    calibratedProbability = calibration.predict(featureVec.values);
  } else {
    calibratedProbability = sigmoidFallback(evidence.score);
  }

  return {
    id: generateSignalId(symbolId, timeframe, lastCandle.time),
    symbolId,
    direction: evidence.direction,
    strength: strengthFor(evidence.score),
    score: evidence.score,
    calibratedProbability,
    entryPrice: levels.entry,
    stopLoss: levels.stopLoss,
    takeProfit: levels.takeProfit,
    reason: evidence.reasons.join('; '),
    indicators: snapshot.indicators,
    pattern: evidence.pattern?.name ?? null,
    time: lastCandle.time,
    timeframe,
    outcome: 'pending',
    frozenAt: null,
    isRevised: false,
    isPreClose: false,
    revisionNote: null,
    barsToResolve,
    spread: spreadInfo.spread,
    spreadSource: spreadInfo.source,
    recommendedExpiry: expiry,
    featureVector: featureVec.values,
  };
}

export function generateSignalId(symbolId: string, timeframe: Timeframe, candleTime: number): string {
  return `${symbolId}:${timeframe}:${candleTime}`;
}

export function shouldRevise(currentScore: number, previousScore: number): boolean {
  return Math.abs(currentScore - previousScore) > REVISION_DELTA_THRESHOLD;
}

export function reviseSignal(
  signal: Signal,
  newScore: number,
  newReasons: string,
  newSnapshot: Snapshot,
  calibration: CalibrationModel | null,
): Signal {
  const featureVec = buildFeatureVector(newSnapshot);
  const calibratedProbability = calibration && calibration.isReady()
    ? calibration.predict(featureVec.values)
    : sigmoidFallback(newScore);

  return {
    ...signal,
    score: newScore,
    reason: newReasons,
    indicators: newSnapshot.indicators,
    calibratedProbability,
    isRevised: true,
    revisionNote: `Score changed from ${signal.score} to ${newScore}`,
  };
}
