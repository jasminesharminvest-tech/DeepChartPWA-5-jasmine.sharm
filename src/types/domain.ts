import { z } from 'zod';

// ─── Union / Literal Types ──────────────────────────────────────────

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type SourceId = 'binance' | 'deriv' | 'twelvedata' | 'finnhub' | 'yahoo';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'degraded'
  | 'reconnecting'
  | 'failed';

export type SignalDirection = 'buy' | 'sell';

export type SignalOutcome = 'pending' | 'win' | 'loss' | 'timeout';

export type SignalStrength = 'weak' | 'moderate' | 'strong';

export type MarketRegime = 'trend' | 'range' | 'high-volatility';

export type SpreadSource = 'live' | 'estimated';

export type AssetClass = 'crypto' | 'forex';

export type PatternName =
  // Toggleable patterns (ALL_PATTERNS in settingsStore)
  | 'hammer'
  | 'shooting-star'
  | 'doji'
  | 'pin-bar'
  | 'bullish-engulfing'
  | 'bearish-engulfing'
  | 'bullish-harami'
  | 'bearish-harami'
  | 'inside-bar'
  | 'morning-star'
  | 'evening-star'
  | 'impulse-breakout'
  | 'consolidation-breakout'
  | 'liquidity-sweep'
  | 'liquidity-sweep-reaction'
  | 'mean-reversion'
  | 'strong-order-block-reaction'
  | 'level-reaction'
  // Additional patterns detected in patterns/index.ts
  | 'inverted-hammer'
  | 'hanging-man'
  | 'marubozu-bullish'
  | 'marubozu-bearish'
  | 'spinning-top'
  | 'piercing-line'
  | 'dark-cloud-cover'
  | 'tweezer-bottom'
  | 'tweezer-top'
  | 'three-white-soldiers'
  | 'three-black-crows'
  | 'abandoned-baby-bottom'
  | 'abandoned-baby-top'
  | 'rising-three-methods'
  | 'falling-three-methods';

export type IndicatorFeature =
  | 'rsi'
  | 'ema'
  | 'macd'
  | 'atr'
  | 'bollinger'
  | 'vwap'
  | 'volume-profile'
  | 'fibonacci'
  | 'liquidity-pools'
  | 'super-order-block'
  | 'support-resistance'
  | 'trend-structure'
  | 'market-regime'
  | 'impulse-velocity'
  | 'vsa-classifier'
  | 'order-block-strength';

export type FeatureName = PatternName | IndicatorFeature;

// ─── Interfaces ─────────────────────────────────────────────────────

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Tick {
  price: number;
  time: number;
  bid?: number;
  ask?: number;
}

export interface PatternResult {
  name: PatternName;
  direction: SignalDirection;
  confidence: number;
  strength: SignalStrength;
  time: number;
  volumeConfirmed?: boolean;
}

export interface MarketStructure {
  trend: 'up' | 'down' | 'range';
  bos: boolean;
  choch: boolean;
  swingHigh: number | null;
  swingLow: number | null;
}

export interface IndicatorConfig {
  rsiPeriod: number;
  emaFast: number;
  emaSlow: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  bbPeriod: number;
  bbStdDev: number;
}

export interface IndicatorSnapshot {
  rsi: number | null;
  emaFast: number | null;
  emaSlow: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  vwap: number | null;
  volumeProfilePoc: number | null;
  meanReversionRsi: number | null;
  impulseVelocity: number | null;
}

export interface SeriesPoint {
  time: number;
  value: number | null;
}

export interface IndicatorSeries {
  rsi: SeriesPoint[];
  emaFast: SeriesPoint[];
  emaSlow: SeriesPoint[];
  macd: SeriesPoint[];
  macdSignal: SeriesPoint[];
  macdHistogram: SeriesPoint[];
  bollingerUpper: SeriesPoint[];
  bollingerMiddle: SeriesPoint[];
  bollingerLower: SeriesPoint[];
}

export interface Snapshot {
  indicators: IndicatorSnapshot;
  patterns: PatternResult[];
  structure: MarketStructure;
  regime: MarketRegime;
  lastPrice: number | null;
  candleTime: number | null;
}

export interface Signal {
  id: string;
  symbolId: string;
  direction: SignalDirection;
  strength: SignalStrength;
  score: number;
  calibratedProbability: number | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  indicators: IndicatorSnapshot;
  pattern: PatternName | null;
  time: number;
  timeframe: Timeframe;
  outcome: SignalOutcome;
  frozenAt: number | null;
  isRevised: boolean;
  isPreClose: boolean;
  revisionNote: string | null;
  barsToResolve: number;
  spread: number | null;
  spreadSource: SpreadSource | null;
  recommendedExpiry: number;
  featureVector: number[];
}

export interface SpreadEstimate {
  spread: number;
  source: SpreadSource;
}

export interface CalibrationResult {
  symbolId: string;
  timeframe: Timeframe;
  atrMultiplier: number;
  stopLossPips: number;
  takeProfitPips: number;
  winRate: number;
  totalTrades: number;
  calibratedAt: number;
}

export interface CalibrationState {
  weights: number[];
  bias: number;
  sampleCount: number;
}

export interface MarketHoursConfig {
  openDays: boolean[];
  openMinutesUtc: number;
  closeMinutesUtc: number;
}

export interface Symbol {
  id: string;
  assetClass: AssetClass;
  sourceMap: Record<AssetClass, SourceId[]>;
  displaySymbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  pipSize: number;
  marketHours: MarketHoursConfig | null;
}

export interface DirectionComponents {
  structure: number;
  zones: number;
  liquidity: number;
  trigger: number;
  indicator: number;
  bos: number;
  macd: number;
  meanReversion: number;
}

// ─── Constants ──────────────────────────────────────────────────────

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  rsiPeriod: 14,
  emaFast: 20,
  emaSlow: 50,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  bbPeriod: 20,
  bbStdDev: 2,
};

const PATTERN_NAMES: readonly PatternName[] = [
  'hammer',
  'shooting-star',
  'doji',
  'pin-bar',
  'bullish-engulfing',
  'bearish-engulfing',
  'bullish-harami',
  'bearish-harami',
  'inside-bar',
  'morning-star',
  'evening-star',
  'impulse-breakout',
  'consolidation-breakout',
  'liquidity-sweep',
  'liquidity-sweep-reaction',
  'mean-reversion',
  'strong-order-block-reaction',
  'level-reaction',
];

const INDICATOR_FEATURES: readonly IndicatorFeature[] = [
  'rsi',
  'ema',
  'macd',
  'atr',
  'bollinger',
  'vwap',
  'volume-profile',
  'fibonacci',
  'liquidity-pools',
  'super-order-block',
  'support-resistance',
  'trend-structure',
  'market-regime',
  'impulse-velocity',
  'vsa-classifier',
  'order-block-strength',
];

export const ALL_FEATURES: readonly FeatureName[] = [
  ...PATTERN_NAMES,
  ...INDICATOR_FEATURES,
];

// ─── Zod Schemas ────────────────────────────────────────────────────

export const timeframeSchema = z.enum([
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
]);

export const sourceIdSchema = z.enum([
  'binance',
  'deriv',
  'twelvedata',
  'finnhub',
  'yahoo',
]);

export const connectionStatusSchema = z.enum([
  'idle',
  'connecting',
  'live',
  'degraded',
  'reconnecting',
  'failed',
]);

export const signalDirectionSchema = z.enum(['buy', 'sell']);

export const signalOutcomeSchema = z.enum(['pending', 'win', 'loss', 'timeout']);

export const signalStrengthSchema = z.enum(['weak', 'moderate', 'strong']);

export const patternNameSchema = z.enum([
  'hammer',
  'shooting-star',
  'doji',
  'pin-bar',
  'bullish-engulfing',
  'bearish-engulfing',
  'bullish-harami',
  'bearish-harami',
  'inside-bar',
  'morning-star',
  'evening-star',
  'impulse-breakout',
  'consolidation-breakout',
  'liquidity-sweep',
  'liquidity-sweep-reaction',
  'mean-reversion',
  'strong-order-block-reaction',
  'level-reaction',
  'inverted-hammer',
  'hanging-man',
  'marubozu-bullish',
  'marubozu-bearish',
  'spinning-top',
  'piercing-line',
  'dark-cloud-cover',
  'tweezer-bottom',
  'tweezer-top',
  'three-white-soldiers',
  'three-black-crows',
  'abandoned-baby-bottom',
  'abandoned-baby-top',
  'rising-three-methods',
  'falling-three-methods',
]);

export const assetClassSchema = z.enum(['crypto', 'forex']);

export const featureNameSchema = z.enum([
  ...patternNameSchema.options,
  ...INDICATOR_FEATURES,
] as [FeatureName, ...FeatureName[]]);

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const tickSchema = z.object({
  price: z.number(),
  time: z.number(),
  bid: z.number().optional(),
  ask: z.number().optional(),
});

export const patternResultSchema = z.object({
  name: patternNameSchema,
  direction: signalDirectionSchema,
  confidence: z.number().min(0).max(1),
  strength: signalStrengthSchema,
  time: z.number(),
  volumeConfirmed: z.boolean().optional(),
});

export const marketStructureSchema = z.object({
  trend: z.enum(['up', 'down', 'range']),
  bos: z.boolean(),
  choch: z.boolean(),
  swingHigh: z.number().nullable(),
  swingLow: z.number().nullable(),
});

export const marketRegimeSchema = z.enum(['trend', 'range', 'high-volatility']);

export const indicatorConfigSchema = z.object({
  rsiPeriod: z.number(),
  emaFast: z.number(),
  emaSlow: z.number(),
  macdFast: z.number(),
  macdSlow: z.number(),
  macdSignal: z.number(),
  atrPeriod: z.number(),
  bbPeriod: z.number(),
  bbStdDev: z.number(),
});

export const indicatorSnapshotSchema = z.object({
  rsi: z.number().nullable(),
  emaFast: z.number().nullable(),
  emaSlow: z.number().nullable(),
  macd: z.number().nullable(),
  macdSignal: z.number().nullable(),
  macdHistogram: z.number().nullable(),
  atr: z.number().nullable(),
  bollingerUpper: z.number().nullable(),
  bollingerMiddle: z.number().nullable(),
  bollingerLower: z.number().nullable(),
  vwap: z.number().nullable(),
  volumeProfilePoc: z.number().nullable(),
  meanReversionRsi: z.number().nullable(),
  impulseVelocity: z.number().nullable(),
});

const seriesPointSchema = z.object({
  time: z.number(),
  value: z.number().nullable(),
});

export const indicatorSeriesSchema = z.object({
  rsi: z.array(seriesPointSchema),
  emaFast: z.array(seriesPointSchema),
  emaSlow: z.array(seriesPointSchema),
  macd: z.array(seriesPointSchema),
  macdSignal: z.array(seriesPointSchema),
  macdHistogram: z.array(seriesPointSchema),
  bollingerUpper: z.array(seriesPointSchema),
  bollingerMiddle: z.array(seriesPointSchema),
  bollingerLower: z.array(seriesPointSchema),
});

export const snapshotSchema = z.object({
  indicators: indicatorSnapshotSchema,
  patterns: z.array(patternResultSchema),
  structure: marketStructureSchema,
  regime: marketRegimeSchema,
  lastPrice: z.number().nullable(),
  candleTime: z.number().nullable(),
});

export const signalSchema = z.object({
  id: z.string(),
  symbolId: z.string(),
  direction: signalDirectionSchema,
  strength: signalStrengthSchema,
  score: z.number(),
  calibratedProbability: z.number().nullable(),
  entryPrice: z.number(),
  stopLoss: z.number(),
  takeProfit: z.number(),
  reason: z.string(),
  indicators: indicatorSnapshotSchema,
  pattern: patternNameSchema.nullable(),
  time: z.number(),
  timeframe: timeframeSchema,
  outcome: signalOutcomeSchema,
  frozenAt: z.number().nullable(),
  isRevised: z.boolean(),
  isPreClose: z.boolean(),
  revisionNote: z.string().nullable(),
  barsToResolve: z.number(),
  spread: z.number().nullable(),
  spreadSource: z.enum(['live', 'estimated']).nullable(),
  recommendedExpiry: z.number(),
  featureVector: z.array(z.number()),
});

export const calibrationResultSchema = z.object({
  symbolId: z.string(),
  timeframe: timeframeSchema,
  atrMultiplier: z.number(),
  stopLossPips: z.number(),
  takeProfitPips: z.number(),
  winRate: z.number(),
  totalTrades: z.number(),
  calibratedAt: z.number(),
});

export const marketHoursConfigSchema = z.object({
  openDays: z.array(z.boolean()),
  openMinutesUtc: z.number(),
  closeMinutesUtc: z.number(),
});

export const symbolSchema = z.object({
  id: z.string(),
  assetClass: assetClassSchema,
  sourceMap: z.record(assetClassSchema, z.array(sourceIdSchema)),
  displaySymbol: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  displayName: z.string(),
  pipSize: z.number(),
  marketHours: marketHoursConfigSchema.nullable(),
});
