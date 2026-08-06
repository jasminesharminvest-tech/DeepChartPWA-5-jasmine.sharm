import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { useTickStore } from '@/stores/useTickStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { findSymbol } from '@/data/symbols';
import { formatPrice, clsx } from '@/lib/utils';

export function StatusBar() {
  const currentPrice = useTickStore((s) => s.currentPrice);
  const flash = useTickStore((s) => s.lastPriceFlash);
  const loading = useTickStore((s) => s.loading);
  const error = useTickStore((s) => s.error);
  const marketClosed = useTickStore((s) => s.marketClosed);
  const candleCount = useTickStore((s) => s.candles.length);
  const symbolId = useSettingsStore((s) => s.symbolId);
  const symbol = findSymbol(symbolId);

  if (error) {
    return (
      <div className="flex items-center gap-2 border-t border-error-700/40 bg-error-700/20 px-3 py-1.5 text-2xs text-error-400">
        <span className="font-semibold">Ошибка:</span>
        <span className="truncate">{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 border-t border-base-800 bg-base-950 px-3 py-1.5 text-2xs text-base-400">
        <span className="animate-pulse-soft">Загрузка рыночных данных…</span>
      </div>
    );
  }

  const ChangeIcon = flash === 'up' ? TrendingUp : flash === 'down' ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-4 border-t border-base-800 bg-base-950 px-3 py-1.5 text-2xs text-base-400">
      <span className="flex items-center gap-1">
        <span className="text-base-500">цена</span>
        <span className={clsx('font-mono tabular-nums', flash === 'up' ? 'text-success-500' : flash === 'down' ? 'text-error-500' : 'text-base-200')}>
          {currentPrice !== null && symbol ? formatPrice(currentPrice, symbol.pipSize) : '—'}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <ChangeIcon size={11} className={flash === 'up' ? 'text-success-500' : flash === 'down' ? 'text-error-500' : 'text-base-500'} />
        <span className={clsx(flash === 'up' ? 'text-success-500' : flash === 'down' ? 'text-error-500' : 'text-base-500')}>
          {flash === 'up' ? 'рост' : flash === 'down' ? 'падение' : 'стоп'}
        </span>
      </span>
      <span className="ml-auto flex items-center gap-1">
        <span className="text-base-500">свечей</span>
        <span className="font-mono text-base-300">{candleCount}</span>
      </span>
      {marketClosed && (
        <span className="flex items-center gap-1 text-accent-400">
          <Clock size={11} />
          Рынок закрыт
        </span>
      )}
    </div>
  );
}
