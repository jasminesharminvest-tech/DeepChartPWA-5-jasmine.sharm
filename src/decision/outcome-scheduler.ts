import type { Candle, Signal, SignalOutcome } from '@/types/domain';

export interface ResolvedOutcome {
  signalId: string;
  outcome: SignalOutcome;
}

export function resolveOutcome(
  signal: Signal,
  candlesAfterSignal: Candle[],
): ResolvedOutcome | null {
  if (signal.outcome !== 'pending') return null;
  if (candlesAfterSignal.length === 0) return null;

  const barsToCheck = Math.min(candlesAfterSignal.length, signal.barsToResolve);
  const isBuy = signal.direction === 'buy';
  const { stopLoss, takeProfit } = signal;

  for (let i = 0; i < barsToCheck; i++) {
    const c = candlesAfterSignal[i];
    if (isBuy) {
      if (c.low <= stopLoss) return { signalId: signal.id, outcome: 'loss' };
      if (c.high >= takeProfit) return { signalId: signal.id, outcome: 'win' };
    } else {
      if (c.high >= stopLoss) return { signalId: signal.id, outcome: 'loss' };
      if (c.low <= takeProfit) return { signalId: signal.id, outcome: 'win' };
    }
  }

  if (candlesAfterSignal.length >= signal.barsToResolve) {
    return { signalId: signal.id, outcome: 'timeout' };
  }

  return null;
}

export function getCandlesAfterSignal(
  allCandles: Candle[],
  signalTime: number,
): Candle[] {
  const after: Candle[] = [];
  for (const c of allCandles) {
    if (c.time > signalTime) after.push(c);
  }
  return after;
}

export interface PendingSignal {
  signal: Signal;
  barsElapsed: number;
}

export class OutcomeScheduler {
  private pending: PendingSignal[] = [];

  schedule(signal: Signal): void {
    if (signal.outcome !== 'pending') return;
    this.pending.push({ signal, barsElapsed: 0 });
  }

  onCandleClosed(
    allCandles: Candle[],
    onResolve: (resolved: ResolvedOutcome, signal: Signal) => void,
  ): void {
    if (this.pending.length === 0) return;
    const stillPending: PendingSignal[] = [];

    for (const p of this.pending) {
      const candlesAfter = getCandlesAfterSignal(allCandles, p.signal.time);
      const resolved = resolveOutcome(p.signal, candlesAfter);
      if (resolved) {
        onResolve(resolved, p.signal);
      } else {
        stillPending.push({ ...p, barsElapsed: candlesAfter.length });
      }
    }

    this.pending = stillPending;
  }

  clear(): void {
    this.pending = [];
  }

  getPendingCount(): number {
    return this.pending.length;
  }
}
