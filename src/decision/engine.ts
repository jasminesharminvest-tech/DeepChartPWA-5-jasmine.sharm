import type {
  Candle,
  IndicatorConfig,
  Signal,
  SignalOutcome,
  Snapshot,
  Timeframe,
  FeatureName,
  Tick,
} from '@/types/domain';
import type { CalibrationModel } from './calibration-model';
import { buildFullSnapshot } from '@/compute/full-snapshot';
import {
  buildSignal,
  type BuildSignalParams,
} from './signal-builder';
import { addBreadcrumb } from '@/lib/sentry';
import { TIMEFRAME_SECONDS } from '@/data/symbols';

const FREEZE_LEAD_SECONDS = 5;
const DEFAULT_BARS_TO_RESOLVE = 5;
const DEFAULT_SCORE_THRESHOLD = 2;

export interface OutcomeRecord {
  signalId: string;
  outcome: SignalOutcome;
  features: number[];
  score: number;
}

export interface DecisionEngineOptions {
  calibration: CalibrationModel | null;
  barsToResolve: number;
  scoreThreshold?: number;
}

export class DecisionEngine {
  private calibration: CalibrationModel | null;
  private barsToResolve: number;
  private scoreThreshold: number;
  private frozenSignal: Signal | null = null;
  private frozenCandleTime: number | null = null;
  private currentSignal: Signal | null = null;
  private currentSnapshot: Snapshot | null = null;

  constructor(opts: DecisionEngineOptions) {
    this.calibration = opts.calibration;
    this.barsToResolve = opts.barsToResolve > 0 ? opts.barsToResolve : DEFAULT_BARS_TO_RESOLVE;
    this.scoreThreshold = opts.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  }

  snapshot(candleTime: number, serverNowMs: number, timeframeSeconds: number): { isFrozen: boolean; shouldFreeze: boolean } {
    const closeTimeMs = (candleTime + timeframeSeconds) * 1000;
    const msUntilClose = closeTimeMs - serverNowMs;
    const shouldFreeze = msUntilClose <= FREEZE_LEAD_SECONDS * 1000 && msUntilClose > -FREEZE_LEAD_SECONDS * 1000;
    return { isFrozen: this.frozenSignal !== null, shouldFreeze };
  }

  evaluate(
    symbolId: string,
    timeframe: Timeframe,
    candles: Candle[],
    config: IndicatorConfig,
    atrMultiplier: number,
    activeFeatures: FeatureName[],
    tick: Tick | null,
    serverNowMs: number,
  ): Signal | null {
    if (candles.length === 0) return null;
    const lastCandle = candles[candles.length - 1];
    const tfSeconds = TIMEFRAME_SECONDS[timeframe];
    const { shouldFreeze } = this.snapshot(lastCandle.time, serverNowMs, tfSeconds);

    if (this.frozenSignal && this.frozenCandleTime === lastCandle.time) {
      return this.frozenSignal;
    }

    const { snapshot, series } = buildFullSnapshot(candles, config, activeFeatures);
    void series;

    const signal = buildSignal({
      symbolId,
      timeframe,
      candles,
      config,
      atrMultiplier,
      activeFeatures,
      snapshot,
      calibration: this.calibration,
      tick,
      barsToResolve: this.barsToResolve,
      scoreThreshold: this.scoreThreshold,
    } satisfies BuildSignalParams);

    this.currentSignal = signal;
    this.currentSnapshot = snapshot;

    if (shouldFreeze && signal) {
      this.frozenSignal = { ...signal, frozenAt: serverNowMs };
      this.frozenCandleTime = lastCandle.time;
      return this.frozenSignal;
    }

    return signal;
  }

  onCandleClosed(): Signal | null {
    const sig = this.frozenSignal ?? this.currentSignal;
    this.frozenSignal = null;
    this.frozenCandleTime = null;
    return sig;
  }

  recordOutcome(signal: Signal, outcome: SignalOutcome): OutcomeRecord | null {
    if (outcome === 'pending') return null;
    if (!this.calibration) return null;

    const outcomeValue: 1 | 0 = outcome === 'win' ? 1 : 0;
    const sample = {
      features: signal.featureVector,
      score: signal.score,
      outcome: outcomeValue,
    };

    this.calibration.addSample(sample);
    this.calibration.retrain();
    addBreadcrumb(`Calibration retrained: ${this.calibration.getSampleCount()} samples`, {
      outcome,
      score: signal.score,
    });

    return {
      signalId: signal.id,
      outcome,
      features: signal.featureVector,
      score: signal.score,
    };
  }

  getFrozenSignal(): Signal | null {
    return this.frozenSignal;
  }

  getLastSnapshot(): Snapshot | null {
    return this.currentSnapshot;
  }

  setScoreThreshold(threshold: number): void {
    this.scoreThreshold = threshold;
  }
}
