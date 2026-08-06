import { useState, useEffect } from 'react';
import { Activity, Signal, Settings as SettingsIcon, X } from 'lucide-react';
import { IndicatorPanel } from '@/ui/IndicatorPanel';
import { SignalFeed } from '@/ui/SignalFeed';
import { CalibrationPanel } from '@/ui/CalibrationPanel';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { DirectionIndicator } from '@/ui/DirectionIndicator';
import { MarketStructureBadge } from '@/ui/MarketStructureBadge';
import { useAnalyticsStore } from '@/stores/useAnalyticsStore';
import { useTickStore } from '@/stores/useTickStore';
import { clsx } from '@/lib/utils';

type DrawerTab = 'indicators' | 'signals' | 'settings';

interface MobileNavProps {
  fullSnapshot: ReturnType<typeof useTickStore.getState>['fullSnapshot'];
  currentSignal: ReturnType<typeof useAnalyticsStore.getState>['currentSignal'];
}

export function MobileNav({ fullSnapshot, currentSignal }: MobileNavProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab === null) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTab(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 80) {
      setActiveTab(null);
      setTouchStartY(null);
    }
  };

  const tabs: { id: DrawerTab; label: string; icon: typeof Activity }[] = [
    { id: 'indicators', label: 'Индикаторы', icon: Activity },
    { id: 'signals', label: 'Сигналы', icon: Signal },
    { id: 'settings', label: 'Настройки', icon: SettingsIcon },
  ];

  return (
    <>
      {activeTab !== null && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setActiveTab(null)}
        />
      )}

      <div
        className={clsx(
          'fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 lg:hidden',
          activeTab === null ? 'translate-y-full' : 'translate-y-0',
        )}
        style={{ height: '70dvh' }}
      >
        <div
          className="flex h-full flex-col rounded-t-2xl border-t border-base-800 bg-base-950"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <div className="flex items-center justify-between border-b border-base-800 px-4 py-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-base-700" />
            <button
              onClick={() => setActiveTab(null)}
              className="absolute right-4 rounded-lg p-1.5 text-base-400 transition hover:bg-base-800 hover:text-base-100"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-base-800 px-4 py-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-400">
              {activeTab === 'indicators' && 'Анализ'}
              {activeTab === 'signals' && 'Сигналы'}
              {activeTab === 'settings' && 'Настройки'}
            </h3>
            <div className="flex items-center gap-2">
              {activeTab === 'indicators' && <DirectionIndicator signal={currentSignal} size={20} />}
              {activeTab === 'indicators' && fullSnapshot && (
                <MarketStructureBadge structure={fullSnapshot.structure} candleTime={fullSnapshot.candleTime} />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'indicators' && (
              <div className="flex flex-col gap-4">
                <IndicatorPanel />
                <CalibrationPanel />
              </div>
            )}
            {activeTab === 'signals' && <SignalFeed />}
            {activeTab === 'settings' && <SettingsPanel onClose={() => setActiveTab(null)} />}
          </div>
        </div>
      </div>

      <nav className="flex shrink-0 items-center justify-around border-t border-base-800 bg-base-950 px-2 py-1.5 lg:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(isActive ? null : tab.id)}
              className={clsx(
                'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition',
                isActive ? 'text-secondary-400' : 'text-base-400',
              )}
              aria-label={tab.label}
            >
              <Icon size={20} />
              <span className="text-2xs font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
