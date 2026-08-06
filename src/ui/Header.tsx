import { TIMEFRAMES } from '@/data/symbols';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTickStore } from '@/stores/useTickStore';
import { useAnalyticsStore } from '@/stores/useAnalyticsStore';
import { findSymbol } from '@/data/symbols';
import { formatPrice, formatForexPrice, clsx } from '@/lib/utils';
import { SymbolSelector } from '@/ui/SymbolSelector';
import { ConnectionStatusBadge } from '@/ui/ConnectionStatusBadge';
import { ForexHoursIndicator } from '@/ui/ForexHoursIndicator';
import { PredictionAccuracyBadge } from '@/ui/PredictionAccuracyBadge';
import { CandleTimer } from '@/ui/CandleTimer';
import { Boxes } from 'lucide-react';
import { useState } from 'react';
import { StrategiesModal } from '@/ui/StrategiesModal';
import { AiAnalysisButton } from '@/ui/AiAnalysisOverlay';

interface HeaderProps {
  onAiAnalyze: () => void;
  aiLoading: boolean;
}

export function Header({ onAiAnalyze, aiLoading }: HeaderProps) {
  const timeframe = useSettingsStore((s) => s.timeframe);
  const setTimeframe = useSettingsStore((s) => s.setTimeframe);
  const currentPrice = useTickStore((s) => s.currentPrice);
  const flash = useTickStore((s) => s.lastPriceFlash);
  const marketClosed = useTickStore((s) => s.marketClosed);
  const status = useAnalyticsStore((s) => s.connectionStatus);
  const symbolId = useSettingsStore((s) => s.symbolId);
  const [strategiesOpen, setStrategiesOpen] = useState(false);

  const symbol = findSymbol(symbolId);
  const marketOpen = symbol ? !marketClosed : false;

  return (
    <header className="flex items-center gap-2 border-b border-base-800 bg-base-950 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tracking-tight text-base-100">Терминал</span>
      </div>

      <SymbolSelector />

      <div className="hidden items-center gap-0.5 rounded-lg bg-base-800 p-1 sm:flex">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={clsx(
              'w-10 rounded-md py-1 text-center text-xs font-semibold transition',
              tf === timeframe
                ? 'bg-primary-600 text-white'
                : 'text-base-300 hover:text-base-100',
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="hidden md:block">
        <CandleTimer />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden flex-col items-end sm:flex">
          <span
            className={clsx(
              'font-mono text-base font-bold tabular-nums transition-colors',
              flash === 'up' ? 'text-success-500' : flash === 'down' ? 'text-error-500' : 'text-base-100',
            )}
          >
            {currentPrice !== null && symbol
              ? symbol.assetClass === 'forex'
                ? formatForexPrice(currentPrice, symbol.quoteAsset)
                : formatPrice(currentPrice, symbol.pipSize)
              : '—'}
          </span>
          {symbol && (
            <div className="mt-0.5">
              <ForexHoursIndicator symbol={symbol} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={clsx(
              'rounded-md px-1.5 py-0.5 text-2xs font-bold',
              marketOpen ? 'bg-success-700/30 text-success-400' : 'bg-accent-700/30 text-accent-400',
            )}
          >
            {marketOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ'}
          </span>
          {marketClosed && symbol?.assetClass === 'forex' && (
            <span className="hidden text-2xs font-medium text-warning-400 md:inline">
              Рынок закрыт — показаны данные прошлой пятницы
            </span>
          )}
          <PredictionAccuracyBadge />
          <ConnectionStatusBadge status={status} />
          <AiAnalysisButton onClick={onAiAnalyze} loading={aiLoading} />
          <button
            onClick={() => setStrategiesOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-base-800 p-2 text-base-300 transition hover:bg-base-700 hover:text-base-100"
            aria-label="Стратегии"
          >
            <Boxes size={16} />
          </button>
        </div>
      </div>
      {strategiesOpen && <StrategiesModal onClose={() => setStrategiesOpen(false)} />}
    </header>
  );
}
