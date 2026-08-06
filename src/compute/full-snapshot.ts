import type {
  Candle,
  IndicatorConfig,
  Snapshot,
  FeatureName,
} from '@/types/domain';
import { computeIndicators } from '@/compute/IndicatorAggregator';
import { detectAllPatterns } from '@/compute/patterns';
import { computeStructure } from '@/compute/indicators/trend-structure';
import { detectMarketRegime } from '@/compute/indicators/market-regime';

export function buildFullSnapshot(
  candles: Candle[],
  config: IndicatorConfig,
  activeFeatures: FeatureName[],
): { snapshot: Snapshot; series: ReturnType<typeof computeIndicators>['series'] } {
  const { snapshot: indicators, series } = computeIndicators(candles, config, activeFeatures);
  const patterns = detectAllPatterns(candles, activeFeatures, indicators);

  const has = (name: FeatureName) => activeFeatures.length === 0 || activeFeatures.includes(name);

  const structure = has('trend-structure')
    ? computeStructure(candles)
    : { trend: 'range' as const, bos: false, choch: false, swingHigh: null, swingLow: null };

  const regime = has('market-regime')
    ? detectMarketRegime(candles)
    : ('range' as const);

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  const fullSnapshot: Snapshot = {
    indicators,
    patterns,
    structure,
    regime,
    lastPrice: lastCandle?.close ?? null,
    candleTime: lastCandle?.time ?? null,
  };

  return { snapshot: fullSnapshot, series };
}
