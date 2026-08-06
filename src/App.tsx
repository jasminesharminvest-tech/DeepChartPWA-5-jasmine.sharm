import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/ui/Header';
import { ChartPanel } from '@/ui/ChartPanel';
import { IndicatorPanel } from '@/ui/IndicatorPanel';
import { SignalFeed } from '@/ui/SignalFeed';
import { CalibrationPanel } from '@/ui/CalibrationPanel';
import { StatusBar } from '@/ui/StatusBar';
import { SettingsButton } from '@/ui/SettingsPanel';
import { HealthCheck } from '@/ui/HealthCheck';
import { Onboarding } from '@/ui/Onboarding';

import { DirectionIndicator } from '@/ui/DirectionIndicator';
import { MarketStructureBadge } from '@/ui/MarketStructureBadge';
import { PriorityAlertBanner } from '@/ui/PriorityAlertBanner';
import { UpdateBanner } from '@/ui/UpdateBanner';
import { AiAnalysisOverlay } from '@/ui/AiAnalysisOverlay';
import { MobileNav } from '@/ui/MobileNav';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTickStore } from '@/stores/useTickStore';
import { useAnalyticsStore } from '@/stores/useAnalyticsStore';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';
import { findSymbol } from '@/data/symbols';
import { unlockAudio } from '@/lib/audio';
import { initSentry } from '@/lib/sentry';

type Phase = 'health' | 'onboarding' | 'terminal';

export default function App() {
  const [phase, setPhase] = useState<Phase>('health');
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const symbolId = useSettingsStore((s) => s.symbolId);
  const timeframe = useSettingsStore((s) => s.timeframe);
  const marketMode = useSettingsStore((s) => s.marketMode);
  const start = useTickStore((s) => s.start);
  const stop = useTickStore((s) => s.stop);
  const candles = useTickStore((s) => s.candles);
  const indicatorSnapshot = useTickStore((s) => s.indicatorSnapshot);
  const indicatorSeries = useTickStore((s) => s.indicatorSeries);
  const fullSnapshot = useTickStore((s) => s.fullSnapshot);
  const currentSignal = useAnalyticsStore((s) => s.currentSignal);
  const prioritySignal = useTickStore((s) => s.prioritySignal);
  const clearPrioritySignal = useTickStore((s) => s.clearPrioritySignal);

  const { state: updateState, update: applyUpdate } = useAppUpdate();
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const ai = useAiAnalysis(symbolId, timeframe, candles);

  useEffect(() => {
    initSentry();
    unlockAudio();
    const onBeforeUnload = () => stop();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [stop]);

  useEffect(() => {
    if (phase !== 'terminal') return;
    void start(symbolId, timeframe);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolId, timeframe, phase, marketMode, start]);

  const dismissPriority = useCallback(() => clearPrioritySignal(), [clearPrioritySignal]);

  if (phase === 'health') {
    return <HealthCheck onReady={() => setPhase(onboardingCompleted ? 'terminal' : 'onboarding')} />;
  }

  if (phase === 'onboarding') {
    return <Onboarding onComplete={() => setPhase('terminal')} />;
  }

  const symbol = findSymbol(symbolId);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-base-950 text-base-100">
      <Header onAiAnalyze={() => void ai.analyze()} aiLoading={ai.state.loading} />
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <ChartPanel candles={candles} snapshot={indicatorSnapshot} series={indicatorSeries} />
            <AiAnalysisOverlay
              loading={ai.state.loading}
              result={ai.state.result}
              error={ai.state.error}
              onAnalyze={() => void ai.analyze()}
              onClear={ai.clear}
            />
          </div>
          <StatusBar />
        </main>

        <aside className="hidden shrink-0 flex-col gap-4 overflow-y-auto border-t border-base-800 bg-base-950 p-4 pb-16 lg:flex lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xs font-bold uppercase tracking-wider text-base-400">Анализ</h2>
            <SettingsButton />
          </div>
          <div className="flex items-center justify-between gap-2">
            <DirectionIndicator signal={currentSignal} size={24} />
            {fullSnapshot && (
              <MarketStructureBadge structure={fullSnapshot.structure} candleTime={fullSnapshot.candleTime} />
            )}
          </div>
          <IndicatorPanel />
          <SignalFeed />
          <CalibrationPanel />
        </aside>
      </div>

      <MobileNav fullSnapshot={fullSnapshot} currentSignal={currentSignal} />

      {prioritySignal && symbol && (
        <PriorityAlertBanner signal={prioritySignal} pipSize={symbol.pipSize} onDismiss={dismissPriority} />
      )}

      {updateState === 'available' && !updateDismissed && (
        <UpdateBanner
          updating={false}
          onUpdate={applyUpdate}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}

      {updateState === 'updating' && (
        <UpdateBanner updating={true} onUpdate={applyUpdate} onDismiss={() => {}} />
      )}
    </div>
  );
}
