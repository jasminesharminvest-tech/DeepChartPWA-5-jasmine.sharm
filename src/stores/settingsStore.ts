import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Timeframe, IndicatorConfig, FeatureName, PatternName } from '@/types/domain';
import { DEFAULT_INDICATOR_CONFIG } from '@/types/domain';
import { ALL_FEATURES } from '@/types/domain';

export const ALL_PATTERNS: readonly PatternName[] = [
  'hammer',
  'shooting-star',
  'doji',
  'pin-bar',
  'bullish-engulfing',
  'bearish-engulfing',
  'bullish-harami',
  'bearish-harami',
  'inside-bar',
  'morning-star',
  'evening-star',
  'impulse-breakout',
  'consolidation-breakout',
  'liquidity-sweep',
  'liquidity-sweep-reaction',
  'mean-reversion',
  'strong-order-block-reaction',
  'level-reaction',
];

export const ALL_INDICATOR_FEATURES: readonly FeatureName[] = [
  'rsi',
  'ema',
  'macd',
  'atr',
  'bollinger',
  'vwap',
  'volume-profile',
  'fibonacci',
  'liquidity-pools',
  'super-order-block',
  'support-resistance',
  'trend-structure',
  'market-regime',
  'impulse-velocity',
  'vsa-classifier',
  'order-block-strength',
];

type SoundUnit = 'pips' | 'points' | 'percent';

export type MarketMode = 'crypto' | 'forex';

export type Sensitivity = 'soft' | 'strict';

interface SettingsState {
  symbolId: string;
  timeframe: Timeframe;
  marketMode: MarketMode;
  indicators: IndicatorConfig;
  soundNewSignal: boolean;
  soundPrioritySignal: boolean;
  soundUnit: SoundUnit;
  atrMultiplier: number;
  priorityThreshold: number;
  activePatterns: string[];
  activeIndicators: string[];
  showBosLayer: boolean;
  showOrderBlocks: boolean;
  showImbalances: boolean;
  showSupportResistance: boolean;
  showEma20: boolean;
  showEma50: boolean;
  showEma200: boolean;
  showBollinger: boolean;
  showMacd: boolean;
  showRejectionBlocks: boolean;
  onboardingCompleted: boolean;
  sensitivity: Sensitivity;
  setSymbol: (id: string) => void;
  setTimeframe: (tf: Timeframe) => void;
  setMarketMode: (mode: MarketMode) => void;
  setIndicators: (patch: Partial<IndicatorConfig>) => void;
  setSoundNewSignal: (enabled: boolean) => void;
  setSoundPrioritySignal: (enabled: boolean) => void;
  setSoundUnit: (unit: SoundUnit) => void;
  setAtrMultiplier: (mult: number) => void;
  setPriorityThreshold: (threshold: number) => void;
  setActivePatterns: (patterns: string[]) => void;
  setActiveIndicators: (indicators: string[]) => void;
  setShowBosLayer: (show: boolean) => void;
  setShowOrderBlocks: (show: boolean) => void;
  setShowImbalances: (show: boolean) => void;
  setShowSupportResistance: (show: boolean) => void;
  setShowEma20: (show: boolean) => void;
  setShowEma50: (show: boolean) => void;
  setShowEma200: (show: boolean) => void;
  setShowBollinger: (show: boolean) => void;
  setShowMacd: (show: boolean) => void;
  setShowRejectionBlocks: (show: boolean) => void;
  setOnboardingCompleted: (done: boolean) => void;
  setSensitivity: (s: Sensitivity) => void;
}

function defaultActiveFeatures(): { patterns: string[]; indicators: string[] } {
  return {
    patterns: [...ALL_PATTERNS],
    indicators: [...ALL_INDICATOR_FEATURES],
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      symbolId: 'BTCUSDT',
      timeframe: '15m',
      marketMode: 'crypto',
      indicators: { ...DEFAULT_INDICATOR_CONFIG },
      soundNewSignal: true,
      soundPrioritySignal: true,
      soundUnit: 'pips',
      atrMultiplier: 2,
      priorityThreshold: 0.75,
      activePatterns: [...ALL_PATTERNS],
      activeIndicators: [...ALL_INDICATOR_FEATURES],
      showBosLayer: false,
      showOrderBlocks: true,
      showImbalances: true,
      showSupportResistance: true,
      showEma20: true,
      showEma50: true,
      showEma200: false,
      showBollinger: false,
      showMacd: false,
      showRejectionBlocks: false,
      onboardingCompleted: false,
      sensitivity: 'soft',
      setSymbol: (id) => set({ symbolId: id }),
      setTimeframe: (tf) => set({ timeframe: tf }),
      setMarketMode: (mode) => set({ marketMode: mode }),
      setIndicators: (patch) => set((s) => ({ indicators: { ...s.indicators, ...patch } })),
      setSoundNewSignal: (enabled) => set({ soundNewSignal: enabled }),
      setSoundPrioritySignal: (enabled) => set({ soundPrioritySignal: enabled }),
      setSoundUnit: (unit) => set({ soundUnit: unit }),
      setAtrMultiplier: (mult) => set({ atrMultiplier: Math.max(0.5, Math.min(5, mult)) }),
      setPriorityThreshold: (threshold) => set({ priorityThreshold: Math.max(0.5, Math.min(0.95, threshold)) }),
      setActivePatterns: (patterns) => set({ activePatterns: patterns }),
      setActiveIndicators: (indicators) => set({ activeIndicators: indicators }),
      setShowBosLayer: (show) => set({ showBosLayer: show }),
      setShowOrderBlocks: (show) => set({ showOrderBlocks: show }),
      setShowImbalances: (show) => set({ showImbalances: show }),
      setShowSupportResistance: (show) => set({ showSupportResistance: show }),
      setShowEma20: (show) => set({ showEma20: show }),
      setShowEma50: (show) => set({ showEma50: show }),
      setShowEma200: (show) => set({ showEma200: show }),
      setShowBollinger: (show) => set({ showBollinger: show }),
      setShowMacd: (show) => set({ showMacd: show }),
      setShowRejectionBlocks: (show) => set({ showRejectionBlocks: show }),
      setOnboardingCompleted: (done) => set({ onboardingCompleted: done }),
      setSensitivity: (s) => set({ sensitivity: s }),
    }),
    {
      name: 'terminal-settings',
      version: 7,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        symbolId: s.symbolId,
        timeframe: s.timeframe,
        marketMode: s.marketMode,
        indicators: s.indicators,
        soundNewSignal: s.soundNewSignal,
        soundPrioritySignal: s.soundPrioritySignal,
        soundUnit: s.soundUnit,
        atrMultiplier: s.atrMultiplier,
        priorityThreshold: s.priorityThreshold,
        activePatterns: s.activePatterns,
        activeIndicators: s.activeIndicators,
        showBosLayer: s.showBosLayer,
        showOrderBlocks: s.showOrderBlocks,
        showImbalances: s.showImbalances,
        showSupportResistance: s.showSupportResistance,
        showEma20: s.showEma20,
        showEma50: s.showEma50,
        showEma200: s.showEma200,
        showBollinger: s.showBollinger,
        showMacd: s.showMacd,
        showRejectionBlocks: s.showRejectionBlocks,
        onboardingCompleted: s.onboardingCompleted,
        sensitivity: s.sensitivity,
      }),
      migrate: (persisted, version) => {
        const s: Record<string, unknown> = ((persisted as Record<string, unknown>) ?? {});
        if (version < 1) {
          if (typeof s.soundEnabled === 'boolean') {
            s.soundNewSignal = s.soundEnabled;
            s.soundPrioritySignal = s.soundEnabled;
            delete s.soundEnabled;
          }
        }
        if (version < 2) {
          const ind = (s.indicators ?? {}) as Record<string, number>;
          if (ind.bollingerPeriod !== undefined) {
            ind.bbPeriod = ind.bollingerPeriod;
            delete ind.bollingerPeriod;
          }
          if (ind.bollingerStdDev !== undefined) {
            ind.bbStdDev = ind.bollingerStdDev;
            delete ind.bollingerStdDev;
          }
          s.indicators = ind;
        }
        if (version < 3) {
          const keys = (s.apiKeys ?? {}) as Record<string, unknown>;
          if (typeof keys.derivAppId !== 'string') keys.derivAppId = '';
          if (typeof keys.yahooProxyUrl !== 'string') keys.yahooProxyUrl = '';
          s.apiKeys = keys;
        }
        if (version < 4) {
          const defaults = defaultActiveFeatures();
          if (!Array.isArray(s.activePatterns) || (s.activePatterns as string[]).length <= 5) {
            s.activePatterns = defaults.patterns;
          }
          if (!Array.isArray(s.activeIndicators) || (s.activeIndicators as string[]).length <= 5) {
            s.activeIndicators = defaults.indicators;
          }
          if (typeof s.priorityThreshold !== 'number') s.priorityThreshold = 0.75;
          if (typeof s.showOrderBlocks !== 'boolean') s.showOrderBlocks = true;
          if (typeof s.showImbalances !== 'boolean') s.showImbalances = true;
          if (typeof s.showSupportResistance !== 'boolean') s.showSupportResistance = true;
          if (typeof s.onboardingCompleted !== 'boolean') s.onboardingCompleted = false;
        }
        if (version < 5) {
          if (s.marketMode !== 'crypto' && s.marketMode !== 'forex') s.marketMode = 'crypto';
        }
        if (version < 6) {
          if (typeof s.showEma20 !== 'boolean') s.showEma20 = true;
          if (typeof s.showEma50 !== 'boolean') s.showEma50 = true;
          if (typeof s.showEma200 !== 'boolean') s.showEma200 = false;
          if (typeof s.showBollinger !== 'boolean') s.showBollinger = false;
          if (typeof s.showMacd !== 'boolean') s.showMacd = false;
          if (typeof s.showRejectionBlocks !== 'boolean') s.showRejectionBlocks = false;
        }
        if (version < 7) {
          if (s.sensitivity !== 'soft' && s.sensitivity !== 'strict') s.sensitivity = 'soft';
          delete (s as Partial<Record<string, unknown>>).apiKeys;
        }
        return s;
      },
    },
  ),
);

export { ALL_FEATURES };
