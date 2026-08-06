import { Zap, Clock } from 'lucide-react';
import { useAnalyticsStore } from '@/stores/useAnalyticsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { findSymbol } from '@/data/symbols';
import { SignalCard } from '@/ui/SignalCard';

export function SignalFeed() {
  const current = useAnalyticsStore((s) => s.currentSignal);
  const signals = useAnalyticsStore((s) => s.signals);
  const symbolId = useSettingsStore((s) => s.symbolId);
  const symbol = findSymbol(symbolId);
  const pipSize = symbol?.pipSize ?? 0.01;

  return (
    <div className="flex flex-col gap-3">
      {current ? (
        <SignalCard signal={current} pipSize={pipSize} />
      ) : (
        <div className="rounded-xl border border-base-800 bg-base-900 p-4 text-center">
          <Zap size={20} className="mx-auto mb-1 text-base-500" />
          <p className="text-xs text-base-400">Нет активного сигнала</p>
          <p className="mt-0.5 text-2xs text-base-500">Ожидание конfluence индикаторов</p>
        </div>
      )}

      {signals.length > 0 && (
        <div className="rounded-xl border border-base-800 bg-base-900 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold text-base-400">
            <Clock size={12} />
            ИСТОРИЯ СИГНАЛОВ
          </div>
          <div className="flex flex-col gap-1.5">
            {signals.map((sig) => (
              <SignalCard key={sig.id} signal={sig} pipSize={pipSize} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
