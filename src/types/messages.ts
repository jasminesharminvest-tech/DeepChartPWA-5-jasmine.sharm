import type {
  Candle,
  IndicatorConfig,
  IndicatorSnapshot,
  IndicatorSeries,
  Snapshot,
  Timeframe,
  FeatureName,
} from './domain';

export function genRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Inbound (main → worker) ──────────────────────────────────────

export type WorkerInboundMessage =
  | {
      type: 'candle_closed';
      requestId: string;
      symbolId: string;
      timeframe: Timeframe;
      candles: Candle[];
      config: IndicatorConfig;
      activeFeatures: FeatureName[];
    }
  | {
      type: 'snapshot_request';
      requestId: string;
      symbolId: string;
      timeframe: Timeframe;
      candles: Candle[];
      config: IndicatorConfig;
      activeFeatures: FeatureName[];
    }
  | {
      type: 'tick_update';
      requestId: string;
      symbolId: string;
      timeframe: Timeframe;
      candles: Candle[];
      config: IndicatorConfig;
      activeFeatures: FeatureName[];
    }
  | {
      type: 'reset_streaming';
      requestId: string;
    };

// ─── Outbound (worker → main) ─────────────────────────────────────

export type WorkerOutboundMessage =
  | {
      type: 'candle_closed_result';
      requestId: string;
      snapshot: Snapshot;
      series: IndicatorSeries;
    }
  | {
      type: 'snapshot_result';
      requestId: string;
      snapshot: Snapshot;
      series: IndicatorSeries;
    }
  | {
      type: 'tick_update_result';
      requestId: string;
      snapshot: IndicatorSnapshot;
    }
  | { type: 'worker_error'; requestId: string; message: string };
