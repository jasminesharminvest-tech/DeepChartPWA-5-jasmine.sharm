import { useState, useMemo } from 'react';
import { FlaskConical, Loader2, CheckCircle2, AlertCircle, Database, TrendingUp, Table2 } from 'lucide-react';
import { calibrate } from '@/decision/Calibration';
import { useTickStore } from '@/stores/useTickStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnalyticsStore } from '@/stores/useAnalyticsStore';
import { findSymbol } from '@/data/symbols';
import { MIN_SAMPLES } from '@/decision/calibration-model';
import { clsx } from '@/lib/utils';
import type { Signal } from '@/types/domain';

const BUCKETS: { label: string; lo: number; hi: number }[] = [
  { label: '0–20%', lo: 0, hi: 0.2 },
  { label: '20–40%', lo: 0.2, hi: 0.4 },
  { label: '40–60%', lo: 0.4, hi: 0.6 },
  { label: '60–80%', lo: 0.6, hi: 0.8 },
  { label: '80–100%', lo: 0.8, hi: 1.001 },
];

interface BucketRow {
  label: string;
  total: number;
  wins: number;
  winRate: number | null;
}

function computeBuckets(signals: Signal[]): BucketRow[] {
  const resolved = signals.filter((s) => s.outcome === 'win' || s.outcome === 'loss');
  return BUCKETS.map((b) => {
    const inBucket = resolved.filter((s) => {
      const p = s.calibratedProbability;
      return p !== null && p >= b.lo && p < b.hi;
    });
    const wins = inBucket.filter((s) => s.outcome === 'win').length;
    return {
      label: b.label,
      total: inBucket.length,
      wins,
      winRate: inBucket.length > 0 ? wins / inBucket.length : null,
    };
  });
}

export function CalibrationPanel() {
  const candles = useTickStore((s) => s.candles);
  const symbolId = useSettingsStore((s) => s.symbolId);
  const timeframe = useSettingsStore((s) => s.timeframe);
  const indicators = useSettingsStore((s) => s.indicators);
  const setAtrMultiplier = useSettingsStore((s) => s.setAtrMultiplier);
  const setCalibrationResult = useAnalyticsStore((s) => s.setCalibrationResult);
  const result = useAnalyticsStore((s) => s.calibrationResult);
  const calibrationReady = useAnalyticsStore((s) => s.calibrationReady);
  const sampleCount = useAnalyticsStore((s) => s.calibrationSampleCount);
  const winRate = useAnalyticsStore((s) => s.winRate);
  const signals = useAnalyticsStore((s) => s.signals);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbol = findSymbol(symbolId);

  const buckets = useMemo(() => computeBuckets(signals), [signals]);
  const hasBucketData = buckets.some((b) => b.total > 0);

  const run = () => {
    if (candles.length < 50 || !symbol) return;
    setError(null);
    setRunning(true);
    setTimeout(() => {
      try {
        const res = calibrate(symbolId, timeframe, candles, indicators, symbol.pipSize);
        setCalibrationResult(res);
        if (res.atrMultiplier > 0) {
          setAtrMultiplier(res.atrMultiplier);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Calibration failed');
      } finally {
        setRunning(false);
      }
    }, 50);
  };

  return (
    <div className="rounded-xl border border-base-800 bg-base-900 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-2xs font-semibold text-base-400">
          <FlaskConical size={12} className="text-secondary-400" />
          КАЛИБРОВКА
        </div>
        <button
          onClick={run}
          disabled={running || candles.length < 50}
          className="flex items-center gap-1 rounded-md bg-secondary-700/30 px-2 py-1 text-2xs font-semibold text-secondary-400 transition hover:bg-secondary-700/50 disabled:opacity-40"
        >
          {running ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
          {running ? 'Выполняется' : 'Калибровать'}
        </button>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-error-700/20 px-2.5 py-1.5 text-2xs text-error-400">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <div className="mt-2.5 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-base-950/50 px-2.5 py-1.5">
          <Database size={11} className={clsx(calibrationReady ? 'text-success-500' : 'text-base-500')} />
          <span className="text-2xs text-base-400">
            {calibrationReady ? 'Калибровка активна' : `Сбор данных (${sampleCount} из ${MIN_SAMPLES})`}
          </span>
          <span className="ml-auto font-mono text-2xs font-semibold text-base-100">{sampleCount}</span>
          <span className={clsx('text-2xs font-bold uppercase', calibrationReady ? 'text-success-500' : 'text-base-500')}>
            {calibrationReady ? 'Готово' : 'Ожидание'}
          </span>
        </div>

        {winRate !== null && (
          <div className="flex items-center gap-1.5 rounded-lg bg-base-950/50 px-2.5 py-1.5">
            <TrendingUp size={11} className="text-secondary-400" />
            <span className="text-2xs text-base-400">Винрейт (лайв)</span>
            <span className="ml-auto font-mono text-2xs font-semibold text-secondary-400">
              {(winRate * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold text-base-400">
          <Table2 size={12} className="text-secondary-400" />
          НАДЁЖНОСТЬ ПО УВЕРЕННОСТИ
        </div>
        {hasBucketData ? (
          <div className="overflow-hidden rounded-lg border border-base-800">
            <table className="w-full text-2xs">
              <thead className="bg-base-950/60 text-base-500">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold">Диап.</th>
                  <th className="px-2 py-1 text-right font-semibold">N</th>
                  <th className="px-2 py-1 text-right font-semibold">Реал. WR</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.label} className="border-t border-base-800/60">
                    <td className="px-2 py-1 text-base-300">{b.label}</td>
                    <td className="px-2 py-1 text-right font-mono text-base-300">{b.total}</td>
                    <td className="px-2 py-1 text-right font-mono font-semibold">
                      {b.winRate === null ? (
                        <span className="text-base-600">—</span>
                      ) : (
                        <span className={bucketColor(b.winRate)}>{(b.winRate * 100).toFixed(0)}%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-2xs text-base-500">
            Пока нет закрытых сигналов. Таблица заполняется по мере закрытия сигналов.
          </p>
        )}
      </div>

      {result && !error && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-2xs">
          <Stat label="ATR множ." value={result.atrMultiplier.toFixed(1)} />
          <Stat label="Винрейт" value={`${(result.winRate * 100).toFixed(0)}%`} />
          <Stat label="Стоп (пункты)" value={result.stopLossPips.toFixed(1)} />
          <Stat label="Цель (пункты)" value={result.takeProfitPips.toFixed(1)} />
          <Stat label="Сделки" value={String(result.totalTrades)} />
          <Stat label="Таймфрейм" value={result.timeframe} />
        </div>
      )}
      {!result && !running && !error && (
        <p className="mt-2 text-2xs text-base-500">
          Тестирует конфигурацию индикаторов на истории для поиска лучшего множителя ATR для стопов и целей.
        </p>
      )}
    </div>
  );
}

function bucketColor(winRate: number): string {
  if (winRate >= 0.6) return 'text-success-400';
  if (winRate >= 0.45) return 'text-secondary-400';
  return 'text-error-400';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-base-950/50 px-2 py-1.5">
      <div className="text-2xs text-base-500">{label}</div>
      <div className="font-mono text-xs font-semibold text-base-100">{value}</div>
    </div>
  );
}
