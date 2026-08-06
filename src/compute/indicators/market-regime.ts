import type { Candle, MarketRegime } from '@/types/domain';
import { lastNonNull } from './helpers';
import { atr } from './atr';

export function detectMarketRegime(candles: Candle[], period: number = 20): MarketRegime {
  if (candles.length < period + 5) return 'range';

  const closes = candles.map((c) => c.close);
  const recent = closes.slice(-period);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
  const stdDev = Math.sqrt(variance);

  const atrArr = atr(candles, 14);
  const atrValue = lastNonNull(atrArr);
  if (atrValue === null || atrValue <= 0) return 'range';

  const slope = (recent[recent.length - 1] - recent[0]) / recent[0];
  if (Math.abs(slope) > 0.02) return 'trend';

  const normalizedVol = stdDev / atrValue;
  if (normalizedVol > 1.5) return 'high-volatility';

  return 'range';
}
