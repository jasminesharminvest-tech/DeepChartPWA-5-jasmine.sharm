import type { Candle, DirectionComponents, SignalDirection, Snapshot } from '@/types/domain';
import { orderBlockStrength, detectImbalances } from '@/compute/indicators/order-block-strength';
import { liquidityPools } from '@/compute/indicators/liquidity-pools';
import { supportResistance } from '@/compute/indicators/support-resistance';
import { lastNonNull } from '@/compute/indicators/helpers';
import { atr } from '@/compute/indicators/atr';
import { FEATURE_NAMES, DEFAULT_WEIGHTS } from './featureCalibration';

export interface DirectionScoreResult {
  direction: SignalDirection;
  score: number;
  components: DirectionComponents;
  reasons: string[];
}

export function computeDirectionScore(
  candles: Candle[],
  snapshot: Snapshot,
): DirectionScoreResult {
  const components: DirectionComponents = {
    structure: 0,
    zones: 0,
    liquidity: 0,
    trigger: 0,
    indicator: 0,
    bos: 0,
    macd: 0,
    meanReversion: 0,
  };

  const buyReasons: string[] = [];
  const sellReasons: string[] = [];
  const last = candles[candles.length - 1];
  const entryPrice = last.close;

  // 1. Structure (BOS/CHoCH)
  const struct = snapshot.structure;
  if (struct.bos) {
    if (struct.trend === 'up') {
      components.structure = 1;
      components.bos = 1;
      buyReasons.push('BOS bullish');
    } else if (struct.trend === 'down') {
      components.structure = -1;
      components.bos = -1;
      sellReasons.push('BOS bearish');
    }
  }
  if (struct.choch) {
    if (struct.trend === 'up') {
      components.structure = 0.5;
      buyReasons.push('CHoCH bullish');
    } else if (struct.trend === 'down') {
      components.structure = -0.5;
      sellReasons.push('CHoCH bearish');
    }
  }

  // 2. Zones (OB proximity)
  const obZones = orderBlockStrength(candles);
  const activeBullOB = obZones.filter((z) => z.direction === 'bullish' && !z.mitigated);
  const activeBearOB = obZones.filter((z) => z.direction === 'bearish' && !z.mitigated);
  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  const proximity = atrValue ? atrValue * 2 : 0;

  for (const ob of activeBullOB) {
    if (Math.abs(entryPrice - ob.low) <= proximity || (entryPrice >= ob.low && entryPrice <= ob.high)) {
      components.zones = 1;
      buyReasons.push('Untouched bullish OB nearby');
      break;
    }
  }
  for (const ob of activeBearOB) {
    if (Math.abs(entryPrice - ob.high) <= proximity || (entryPrice >= ob.low && entryPrice <= ob.high)) {
      components.zones = -1;
      sellReasons.push('Untouched bearish OB nearby');
      break;
    }
  }

  // 3. Liquidity (FVG + liquidity pools)
  const fvgs = detectImbalances(candles);
  const activeFvgs = fvgs.filter((f) => !f.filled);
  for (const fvg of activeFvgs.slice(-3)) {
    if (fvg.direction === 'bullish' && entryPrice >= fvg.lower && entryPrice <= fvg.upper) {
      components.liquidity = 0.5;
      buyReasons.push('Untouched bullish FVG nearby');
      break;
    }
    if (fvg.direction === 'bearish' && entryPrice >= fvg.lower && entryPrice <= fvg.upper) {
      components.liquidity = -0.5;
      sellReasons.push('Untouched bearish FVG nearby');
      break;
    }
  }

  const pools = liquidityPools(candles);
  if (pools.length > 0) {
    const nearestPool = pools.reduce((a, b) =>
      Math.abs(b.price - entryPrice) < Math.abs(a.price - entryPrice) ? b : a,
    );
    if (nearestPool.type === 'buy-side' && Math.abs(nearestPool.price - entryPrice) <= proximity) {
      components.liquidity += 0.3;
      buyReasons.push('Buy-side liquidity pool nearby');
    } else if (nearestPool.type === 'sell-side' && Math.abs(nearestPool.price - entryPrice) <= proximity) {
      components.liquidity -= 0.3;
      sellReasons.push('Sell-side liquidity pool nearby');
    }
  }

  // 4. Trigger (candlestick pattern)
  const patterns = snapshot.patterns;
  if (patterns.length > 0) {
    const topPattern = patterns[patterns.length - 1];
    if (topPattern.direction === 'buy') {
      components.trigger = topPattern.confidence;
      buyReasons.push(`${topPattern.name} pattern (${(topPattern.confidence * 100).toFixed(0)}%)`);
    } else if (topPattern.direction === 'sell') {
      components.trigger = -topPattern.confidence;
      sellReasons.push(`${topPattern.name} pattern (${(topPattern.confidence * 100).toFixed(0)}%)`);
    }
  }

  // 5. Indicator (EMA/RSI/Bollinger)
  const ind = snapshot.indicators;
  if (ind.emaFast !== null && ind.emaSlow !== null) {
    if (ind.emaFast > ind.emaSlow) {
      components.indicator += 0.5;
      buyReasons.push('EMA fast above slow');
    } else if (ind.emaFast < ind.emaSlow) {
      components.indicator -= 0.5;
      sellReasons.push('EMA fast below slow');
    }
  }
  if (ind.rsi !== null) {
    if (ind.rsi < 30) {
      components.indicator += 0.3;
      buyReasons.push(`RSI oversold (${ind.rsi.toFixed(1)})`);
    } else if (ind.rsi > 70) {
      components.indicator -= 0.3;
      sellReasons.push(`RSI overbought (${ind.rsi.toFixed(1)})`);
    }
  }
  components.indicator = Math.max(-1, Math.min(1, components.indicator));

  // 6. MACD histogram
  if (ind.macdHistogram !== null) {
    if (ind.macdHistogram > 0) {
      components.macd = Math.min(1, ind.macdHistogram);
      buyReasons.push('MACD histogram positive');
    } else if (ind.macdHistogram < 0) {
      components.macd = Math.max(-1, ind.macdHistogram);
      sellReasons.push('MACD histogram negative');
    }
  }

  // 7. Mean reversion (Bollinger + RSI)
  if (ind.bollingerLower !== null && ind.bollingerUpper !== null && ind.bollingerMiddle !== null) {
    if (entryPrice <= ind.bollingerLower) {
      components.meanReversion = 0.5;
      buyReasons.push('Price at lower Bollinger band');
    } else if (entryPrice >= ind.bollingerUpper) {
      components.meanReversion = -0.5;
      sellReasons.push('Price at upper Bollinger band');
    }
  }

  // Compute weighted score, scaled to match the 0-10 evidence range
  let weightedScore = 0;
  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    const name = FEATURE_NAMES[i];
    const weight = DEFAULT_WEIGHTS[name];
    const componentValue = components[name];
    weightedScore += weight * componentValue;
  }
  // Scale from raw weighted sum to the 0-10 score range used by the signal builder
  const scaledScore = weightedScore * 10;

  const direction: SignalDirection = scaledScore > 0 ? 'buy' : scaledScore < 0 ? 'sell' : 'buy';
  const score = Math.abs(scaledScore);
  const reasons = direction === 'buy' ? buyReasons : sellReasons;

  return { direction, score, components, reasons };
}

export function isPatternInRange(candles: Candle[], _snapshot: Snapshot): boolean {
  const levels = supportResistance(candles);
  const last = candles[candles.length - 1];
  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (!atrValue || atrValue <= 0) return false;

  const nearLevel = levels.some((l) => Math.abs(last.close - l.price) <= atrValue);
  const obZones = orderBlockStrength(candles);
  const nearOB = obZones.some((z) =>
    !z.mitigated && last.close >= z.low - atrValue * 0.5 && last.close <= z.high + atrValue * 0.5,
  );
  return !nearLevel && !nearOB;
}
