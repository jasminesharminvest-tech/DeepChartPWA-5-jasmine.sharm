/// <reference lib="webworker" />
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '@/types/messages';
import type { IndicatorConfig } from '@/types/domain';
import { buildFullSnapshot } from '@/compute/full-snapshot';
import { computeIndicators } from '@/compute/IndicatorAggregator';
import { ema, StreamingEMA } from '@/compute/indicators/ema';
import { lastNonNull } from '@/compute/indicators/helpers';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerOutboundMessage): void {
  ctx.postMessage(msg);
}

interface StreamingState {
  emaFast: StreamingEMA;
  emaSlow: StreamingEMA;
  emaSignal: StreamingEMA | null;
  macdPrevFast: number | null;
  macdPrevSlow: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollMiddle: number | null;
  bollUpper: number | null;
  bollLower: number | null;
  bollBuffer: number[];
  bollSum: number;
  bollSumSq: number;
  lastCandleTime: number | null;
}

let streaming: StreamingState | null = null;

function createStreaming(config: IndicatorConfig): StreamingState {
  return {
    emaFast: new StreamingEMA(config.emaFast),
    emaSlow: new StreamingEMA(config.emaSlow),
    emaSignal: null,
    macdPrevFast: null,
    macdPrevSlow: null,
    macdLine: null,
    macdSignal: null,
    macdHistogram: null,
    bollMiddle: null,
    bollUpper: null,
    bollLower: null,
    bollBuffer: [],
    bollSum: 0,
    bollSumSq: 0,
    lastCandleTime: null,
  };
}

function seedStreamingFromBatch(
  candles: { close: number; time: number }[],
  config: IndicatorConfig,
): StreamingState {
  const closes = candles.map((c) => c.close);
  const state = createStreaming(config);

  const emaFastArr = ema(closes, config.emaFast);
  const emaSlowArr = ema(closes, config.emaSlow);

  const lastFast = lastNonNull(emaFastArr);
  const lastSlow = lastNonNull(emaSlowArr);
  if (lastFast !== null) state.emaFast.seed(lastFast);
  if (lastSlow !== null) state.emaSlow.seed(lastSlow);

  state.lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : null;
  return state;
}

ctx.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
  const data = e.data;
  try {
    switch (data.type) {
      case 'candle_closed':
      case 'snapshot_request': {
        const { snapshot, series } = buildFullSnapshot(data.candles, data.config, data.activeFeatures);
        const resultType = data.type === 'candle_closed' ? 'candle_closed_result' : 'snapshot_result';
        streaming = seedStreamingFromBatch(data.candles, data.config);
        post({ type: resultType, requestId: data.requestId, snapshot, series });
        break;
      }
      case 'tick_update': {
        const snapshot = computeIncremental(data);
        post({ type: 'tick_update_result', requestId: data.requestId, snapshot });
        break;
      }
      case 'reset_streaming': {
        streaming = null;
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'compute failed';
    post({ type: 'worker_error', requestId: data.requestId, message });
  }
};

function computeIncremental(
  data: Extract<WorkerInboundMessage, { type: 'tick_update' }>,
): import('@/types/domain').IndicatorSnapshot {
  const candles = data.candles;
  const config = data.config;
  const activeFeatures = data.activeFeatures;

  if (!streaming || candles.length === 0) {
    return computeIndicators(candles, config, activeFeatures).snapshot;
  }

  const lastCandle = candles[candles.length - 1];

  if (streaming.lastCandleTime === null || lastCandle.time !== streaming.lastCandleTime) {
    streaming = seedStreamingFromBatch(candles, config);
    return computeIndicators(candles, config, activeFeatures).snapshot;
  }

  streaming.emaFast.update(lastCandle.close);
  streaming.emaSlow.update(lastCandle.close);

  return computeIndicators(candles, config, activeFeatures).snapshot;
}

export {};
