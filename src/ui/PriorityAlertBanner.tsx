import { useEffect, useState } from 'react';
import { AlertTriangle, X, Timer } from 'lucide-react';
import type { Signal } from '@/types/domain';
import { formatPrice } from '@/lib/utils';

interface PriorityAlertBannerProps {
  signal: Signal;
  pipSize: number;
  onDismiss: () => void;
}

const COUNTDOWN_SECONDS = 30;

export function PriorityAlertBanner({ signal, pipSize, onDismiss }: PriorityAlertBannerProps) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    setRemaining(COUNTDOWN_SECONDS);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [signal.id, onDismiss]);

  const isBuy = signal.direction === 'buy';
  const progress = (remaining / COUNTDOWN_SECONDS) * 100;

  return (
    /* width bumped to 216px (8px grid) so 3 equal cols have ~60px content area each */
    <div className="absolute left-2 top-2 z-50 w-[216px] animate-slide-up rounded-lg border border-secondary-600 bg-base-900/95 shadow-xl backdrop-blur">
      {/* ── header row ── */}
      <div className="flex items-center justify-between border-b border-secondary-800/50 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={10} className="text-secondary-400" />
          <span className="text-2xs font-bold uppercase tracking-wider text-secondary-400">
            Сигнал
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="rounded p-0.5 text-base-400 transition hover:bg-base-800 hover:text-base-100"
        >
          <X size={10} />
        </button>
      </div>

      {/* ── body ── */}
      <div className="px-3 py-2">
        {/* direction + strength + countdown */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-2xs font-bold uppercase ${isBuy ? 'text-success-500' : 'text-error-500'}`}
            >
              {isBuy ? 'Покупка' : 'Продажа'}
            </span>
            <span className="text-3xs font-bold uppercase text-secondary-400">{signal.strength}</span>
          </div>
          <div className="flex items-center gap-1 text-secondary-400">
            <Timer size={9} />
            <span className="font-mono text-2xs font-semibold tabular-nums">{remaining}s</span>
          </div>
        </div>

        {/* ── Вход / Стоп / Цель — gap-2 = 8px, px-2 py-1.5 = 8px/6px ── */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <LevelCell label="Вход" color="text-base-100">
            {formatPrice(signal.entryPrice, pipSize)}
          </LevelCell>
          <LevelCell label="Стоп" color="text-error-500">
            {formatPrice(signal.stopLoss, pipSize)}
          </LevelCell>
          <LevelCell label="Цель" color="text-success-500">
            {formatPrice(signal.takeProfit, pipSize)}
          </LevelCell>
        </div>

        {/* countdown progress bar */}
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-base-800">
          <div
            className="h-full rounded-full bg-secondary-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LevelCell({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded bg-base-950/60 px-2 py-1.5">
      <div className="text-3xs font-medium text-base-500">{label}</div>
      <div className={`mt-0.5 font-mono text-2xs font-semibold tabular-nums ${color}`}>
        {children}
      </div>
    </div>
  );
}
