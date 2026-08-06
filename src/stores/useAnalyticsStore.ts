import { create } from 'zustand';
import type { Signal, CalibrationResult, ConnectionStatus, SignalOutcome, CalibrationState } from '@/types/domain';

const MAX_SIGNALS = 20;

interface AnalyticsState {
  signals: Signal[];
  currentSignal: Signal | null;
  calibrationReady: boolean;
  calibrationSampleCount: number;
  calibrationState: CalibrationState | null;
  winRate: number | null;
  connectionStatus: ConnectionStatus;
  calibrationResult: CalibrationResult | null;
  addSignal: (signal: Signal) => void;
  upsertSignal: (signal: Signal) => void;
  setCurrentSignal: (signal: Signal | null) => void;
  updateSignalOutcome: (signalId: string, outcome: SignalOutcome) => void;
  setCalibrationResult: (result: CalibrationResult | null) => void;
  setCalibrationState: (state: CalibrationState | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  clearAll: () => void;
  recomputeStats: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  signals: [],
  currentSignal: null,
  calibrationReady: false,
  calibrationSampleCount: 0,
  calibrationState: null,
  winRate: null,
  connectionStatus: 'idle',
  calibrationResult: null,

  addSignal: (signal) =>
    set((s) => {
      const signals = [signal, ...s.signals].slice(0, MAX_SIGNALS);
      return { signals };
    }),

  upsertSignal: (signal) =>
    set((s) => {
      const idx = s.signals.findIndex((sig) => sig.id === signal.id);
      if (idx >= 0) {
        const signals = [...s.signals];
        signals[idx] = signal;
        return { signals };
      }
      return { signals: [signal, ...s.signals].slice(0, MAX_SIGNALS) };
    }),

  setCurrentSignal: (signal) => set({ currentSignal: signal }),

  updateSignalOutcome: (signalId, outcome) =>
    set((s) => {
      const signals = s.signals.map((sig) =>
        sig.id === signalId ? { ...sig, outcome } : sig,
      );
      const currentSignal = s.currentSignal?.id === signalId
        ? { ...s.currentSignal, outcome }
        : s.currentSignal;
      return { signals, currentSignal };
    }),

  setCalibrationResult: (result) => {
    if (result) {
      set({
        calibrationResult: result,
        calibrationReady: result.totalTrades > 0,
        calibrationSampleCount: result.totalTrades,
        winRate: result.winRate > 0 ? result.winRate : null,
      });
    } else {
      set({ calibrationResult: null, calibrationReady: false, calibrationSampleCount: 0, winRate: null });
    }
  },

  setCalibrationState: (state) => {
    if (state) {
      set({
        calibrationState: state,
        calibrationSampleCount: state.sampleCount,
        calibrationReady: state.sampleCount >= 10,
      });
    } else {
      set({ calibrationState: null, calibrationSampleCount: 0, calibrationReady: false });
    }
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  clearAll: () => set({
    signals: [],
    currentSignal: null,
    calibrationReady: false,
    calibrationSampleCount: 0,
    calibrationState: null,
    winRate: null,
    calibrationResult: null,
  }),

  recomputeStats: () => {
    const { signals } = get();
    const completed = signals.filter((s) => s.outcome === 'win' || s.outcome === 'loss');
    if (completed.length === 0) {
      set({ winRate: null });
      return;
    }
    const wins = completed.filter((s) => s.outcome === 'win').length;
    set({ winRate: wins / completed.length, calibrationSampleCount: completed.length });
  },
}));
