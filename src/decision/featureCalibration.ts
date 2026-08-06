export const FEATURE_NAMES = [
  'structure',
  'zones',
  'liquidity',
  'trigger',
  'indicator',
  'bos',
  'macd',
  'meanReversion',
] as const;

export type FeatureCalibrationName = (typeof FEATURE_NAMES)[number];

export const FEATURE_COUNT = FEATURE_NAMES.length;

export const DEFAULT_WEIGHTS: Record<FeatureCalibrationName, number> = {
  structure: 2.0,
  zones: 1.5,
  liquidity: 1.2,
  trigger: 1.5,
  indicator: 1.5,
  bos: 2.0,
  macd: 1.0,
  meanReversion: 1.0,
};
