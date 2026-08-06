import { ArrowUpCircle, ArrowDownCircle, Target, Shield, RefreshCw, Activity, Timer } from 'lucide-react';
import type { Signal, SignalStrength, SpreadSource } from '@/types/domain';
import { formatPrice, formatTime, clsx } from '@/lib/utils';

interface SignalCardProps {
  signal: Signal;
  pipSize: number;
  compact?: boolean;
}

export function SignalCard({ signal, pipSize, compact = false }: SignalCardProps) {
  const isBuy = signal.direction === 'buy';
  const sideColor = isBuy ? 'text-success-500' : 'text-error-500';
  const sideBg = isBuy ? 'bg-success-700/20 border-success-700/40' : 'bg-error-700/20 border-error-700/40';
  const Icon = isBuy ? ArrowUpCircle : ArrowDownCircle;
  const prob = signal.calibratedProbability;
  const probPct = prob !== null ? `${(prob * 100).toFixed(0)}%` : '—';

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-base-950/40 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-bold', isBuy ? 'text-success-500' : 'text-error-500')}>
            {isBuy ? 'П' : 'S'}
          </span>
          <span className="font-mono text-2xs text-base-200">
            {formatPrice(signal.entryPrice, pipSize)}
          </span>
          {signal.isRevised && <RefreshCw size={10} className="text-accent-400" />}
          {signal.isPreClose && <span className="rounded bg-warning-700/30 px-1 text-2xs font-bold uppercase text-warning-400">ПК</span>}
        </div>
        <div className="flex items-center gap-2">
          <StrengthBadge strength={signal.strength} />
          <OutcomeBadge outcome={signal.outcome} />
          <span className="text-2xs text-base-500">{formatTime(signal.time)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-xl border p-3.5 animate-slide-up', sideBg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={20} className={sideColor} />
          <span className={clsx('text-sm font-bold uppercase tracking-wide', sideColor)}>
            {signal.direction}
          </span>
          <StrengthBadge strength={signal.strength} />
          {signal.isRevised && (
            <span className="flex items-center gap-0.5 rounded bg-accent-700/30 px-1.5 py-0.5 text-2xs font-bold uppercase text-accent-400">
              <RefreshCw size={10} />
              Обновлён
            </span>
          )}
          {signal.isPreClose && (
            <span className="flex items-center gap-0.5 rounded bg-warning-700/30 px-1.5 py-0.5 text-2xs font-bold uppercase text-warning-400">
              <Timer size={10} />
              Досрочный выход
            </span>
          )}
        </div>
        <span className="text-2xs text-base-400">{formatTime(signal.time)}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <LevelBox label="Вход" value={formatPrice(signal.entryPrice, pipSize)} />
        <LevelBox label="Стоп" value={formatPrice(signal.stopLoss, pipSize)} tone="error" />
        <LevelBox label="Цель" value={formatPrice(signal.takeProfit, pipSize)} tone="success" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-base-950/50 px-2.5 py-1.5">
          <Activity size={12} className="text-secondary-400" />
          <span className="text-2xs text-base-400">Вероятн.</span>
          <span className="font-mono text-2xs font-semibold text-secondary-400">{probPct}</span>
        </div>
        {signal.spread !== null && (
          <div className="flex items-center gap-1 rounded-lg bg-base-950/50 px-2.5 py-1.5">
            <Target size={12} className="text-base-400" />
            <span className="text-2xs text-base-400">Спред</span>
            <span className="font-mono text-2xs font-semibold text-base-100">
              {formatPrice(signal.spread, pipSize)}
            </span>
            <SpreadBadge source={signal.spreadSource} />
          </div>
        )}
        {signal.recommendedExpiry !== null && (
          <div className="flex items-center gap-1 rounded-lg bg-base-950/50 px-2.5 py-1.5">
            <Timer size={12} className="text-base-400" />
            <span className="text-2xs text-base-400">Экспир.</span>
            <span className="font-mono text-2xs font-semibold text-base-100">
              {formatExpiry(signal.recommendedExpiry)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-1 rounded-lg bg-base-950/50 px-2.5 py-1.5">
        <Shield size={12} className="text-base-400" />
        <span className="text-2xs text-base-300">{signal.reason}</span>
      </div>

      {signal.pattern && (
        <div className="mt-1.5 flex items-center gap-1 text-2xs text-secondary-400">
          <Target size={12} />
          Паттерн: {signal.pattern.replace(/-/g, ' ')}
        </div>
      )}

      {signal.isRevised && signal.revisionNote && (
        <div className="mt-1.5 flex items-center gap-1 text-2xs text-accent-400">
          <RefreshCw size={12} />
          {signal.revisionNote}
        </div>
      )}
    </div>
  );
}

export function SpreadBadge({ source }: { source: SpreadSource | null }) {
  if (!source) return null;
  const isLive = source === 'live';
  return (
    <span className={clsx(
      'rounded px-1 py-0.5 text-2xs font-bold uppercase',
      isLive ? 'bg-success-700/20 text-success-400' : 'bg-base-700 text-base-400',
    )}>
      {isLive ? 'Лайв' : 'Оценка'}
    </span>
  );
}

export function StrengthBadge({ strength }: { strength: SignalStrength }) {
  const styles: Record<SignalStrength, string> = {
    weak: 'bg-base-700 text-base-300',
    moderate: 'bg-accent-700/30 text-accent-400',
    strong: 'bg-secondary-700/30 text-secondary-400',
  };
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-2xs font-bold uppercase', styles[strength])}>
      {strength === 'weak' ? 'Слабый' : strength === 'moderate' ? 'Средний' : 'Сильный'}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Signal['outcome'] }) {
  if (outcome === 'pending') return null;
  const styles: Record<string, string> = {
    win: 'bg-success-700/30 text-success-400',
    loss: 'bg-error-700/30 text-error-400',
    timeout: 'bg-base-700 text-base-400',
  };
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-2xs font-bold uppercase', styles[outcome])}>
      {outcome === 'win' ? 'Прибыль' : outcome === 'loss' ? 'Убыток' : 'Тайм-аут'}
    </span>
  );
}

function LevelBox({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'error' | 'success';
}) {
  const colors = {
    neutral: 'text-base-100',
    error: 'text-error-500',
    success: 'text-success-500',
  };
  return (
    <div className="rounded-lg bg-base-950/50 px-2 py-1.5">
      <div className="text-2xs text-base-500">{label}</div>
      <div className={clsx('font-mono text-xs font-semibold tabular-nums', colors[tone])}>{value}</div>
    </div>
  );
}

function formatExpiry(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}
