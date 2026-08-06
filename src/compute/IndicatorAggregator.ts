import type { Candle, IndicatorConfig, IndicatorSnapshot, IndicatorSeries, FeatureName } from '@/types/domain';
import { rsi as calcRsi } from '@/compute/indicators/rsi';
import { ema } from '@/compute/indicators/ema';
import { macd } from '@/compute/indicators/macd';
import { atr } from '@/compute/indicators/atr';
import { bollinger } from '@/compute/indicators/bollinger';
import { vwapLast } from '@/compute/indicators/vwap';
import { volumeProfilePoc } from '@/compute/indicators/volume-profile';
import { computeImpulseVelocity } from '@/compute/indicators/impulse-velocity';
import { lastNonNull, zipTime } from '@/compute/indicators/helpers';

export interface ComputeResult {
  snapshot: IndicatorSnapshot;
  series: IndicatorSeries;
}

export function computeIndicators(
  candles: Candle[],
  config: IndicatorConfig,
  activeFeatures: FeatureName[] = [],
): ComputeResult {
  const closes = candles.map((c) => c.close);
  const has = (name: FeatureName) => activeFeatures.length === 0 || activeFeatures.includes(name);

  const rsiArr = calcRsi(closes, config.rsiPeriod);
  const emaFastArr = ema(closes, config.emaFast);
  const emaSlowArr = ema(closes, config.emaSlow);
  const macdResult = macd(closes, config.macdFast, config.macdSlow, config.macdSignal);
  const atrArr = atr(candles, config.atrPeriod);
  const boll = bollinger(closes, config.bbPeriod, config.bbStdDev);

  const snapshot: IndicatorSnapshot = {
    rsi: lastNonNull(rsiArr),
    emaFast: lastNonNull(emaFastArr),
    emaSlow: lastNonNull(emaSlowArr),
    macd: lastNonNull(macdResult.macd),
    macdSignal: lastNonNull(macdResult.signal),
    macdHistogram: lastNonNull(macdResult.histogram),
    atr: lastNonNull(atrArr),
    bollingerUpper: lastNonNull(boll.upper),
    bollingerMiddle: lastNonNull(boll.middle),
    bollingerLower: lastNonNull(boll.lower),
    vwap: has('vwap') ? vwapLast(candles) : null,
    volumeProfilePoc: has('volume-profile') ? volumeProfilePoc(candles) : null,
    meanReversionRsi: has('mean-reversion') ? lastNonNull(calcRsi(closes, 7)) : null,
    impulseVelocity: has('impulse-velocity') ? computeImpulseVelocity(candles, config.atrPeriod) : null,
  };

  const series: IndicatorSeries = {
    rsi: zipTime(candles, rsiArr),
    emaFast: zipTime(candles, emaFastArr),
    emaSlow: zipTime(candles, emaSlowArr),
    macd: zipTime(candles, macdResult.macd),
    macdSignal: zipTime(candles, macdResult.signal),
    macdHistogram: zipTime(candles, macdResult.histogram),
    bollingerUpper: zipTime(candles, boll.upper),
    bollingerMiddle: zipTime(candles, boll.middle),
    bollingerLower: zipTime(candles, boll.lower),
  };

  return { snapshot, series };
}

export function computeSnapshot(
  candles: Candle[],
  config: IndicatorConfig,
  activeFeatures: FeatureName[] = [],
): IndicatorSnapshot {
  return computeIndicators(candles, config, activeFeatures).snapshot;
}
