import type { SimulatedTrade } from './simulator';

export interface ReliabilityBin {
  binStart: number;
  binEnd: number;
  count: number;
  avgPredicted: number;
  avgActual: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  averageR: number;
  brierScore: number;
  maxDrawdownR: number;
  profitFactor: number;
  reliabilityBins: ReliabilityBin[];
}

export interface SplitMetrics {
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics;
  all: BacktestMetrics;
}

const WIN_R = 2;
const LOSS_R = -1;
const TIMEOUT_R = 0;

export function computeMetrics(trades: SimulatedTrade[]): BacktestMetrics {
  const total = trades.length;
  const wins = trades.filter((t) => t.outcome === 'win').length;
  const losses = trades.filter((t) => t.outcome === 'loss').length;
  const timeouts = trades.filter((t) => t.outcome === 'timeout').length;

  const winRate = total > 0 ? wins / total : 0;

  const rValues = trades.map((t) => {
    if (t.outcome === 'win') return Math.max(0, WIN_R - t.spreadCostR);
    if (t.outcome === 'loss') return LOSS_R - t.spreadCostR;
    return TIMEOUT_R - t.spreadCostR;
  });

  const averageR = total > 0 ? rValues.reduce((a, b) => a + b, 0) / total : 0;

  const brierScore =
    total > 0
      ? trades.reduce((sum, t) => {
          const prob = t.signal.calibratedProbability ?? 0.5;
          const actual = t.outcome === 'win' ? 1 : 0;
          return sum + (prob - actual) ** 2;
        }, 0) / total
      : 0;

  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  for (const r of rValues) {
    cumulative += r;
    peak = Math.max(peak, cumulative);
    maxDD = Math.max(maxDD, peak - cumulative);
  }

  const grossProfit = rValues.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(rValues.filter((r) => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    totalTrades: total,
    wins,
    losses,
    timeouts,
    winRate,
    averageR,
    brierScore,
    maxDrawdownR: maxDD,
    profitFactor,
    reliabilityBins: computeReliabilityBins(trades),
  };
}

export function computeSplitMetrics(trades: SimulatedTrade[]): SplitMetrics {
  const inSample = trades.filter((t) => t.inSample);
  const outOfSample = trades.filter((t) => !t.inSample);
  return {
    inSample: computeMetrics(inSample),
    outOfSample: computeMetrics(outOfSample),
    all: computeMetrics(trades),
  };
}

function computeReliabilityBins(trades: SimulatedTrade[]): ReliabilityBin[] {
  const numBins = 10;
  const bins: ReliabilityBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const binStart = i / numBins;
    const binEnd = (i + 1) / numBins;
    const inBin = trades.filter((t) => {
      const prob = t.signal.calibratedProbability ?? 0.5;
      if (i === numBins - 1) return prob >= binStart && prob <= binEnd;
      return prob >= binStart && prob < binEnd;
    });

    bins.push({
      binStart,
      binEnd,
      count: inBin.length,
      avgPredicted:
        inBin.length > 0
          ? inBin.reduce((s, t) => s + (t.signal.calibratedProbability ?? 0.5), 0) / inBin.length
          : 0,
      avgActual:
        inBin.length > 0 ? inBin.filter((t) => t.outcome === 'win').length / inBin.length : 0,
    });
  }

  return bins;
}
