import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { BacktestMetrics, SplitMetrics } from './metrics';
import type { SimulatedTrade } from './simulator';

export interface ReportOptions {
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
  outputDir: string;
}

export function generateReport(
  trades: SimulatedTrade[],
  split: SplitMetrics,
  options: ReportOptions,
): void {
  printConsoleReport(split, options);
  writeMarkdownReport(trades, split, options);
  writeJsonReport(trades, split, options);
}

function printConsoleReport(split: SplitMetrics, options: ReportOptions): void {
  const line = '\u2500'.repeat(52);
  console.log('\n' + '\u2550'.repeat(52));
  console.log('  BACKTEST REPORT');
  console.log('\u2550'.repeat(52));
  console.log(`  Symbol:      ${options.symbol}`);
  console.log(`  Timeframe:   ${options.timeframe}`);
  console.log(`  Period:      ${options.from} \u2192 ${options.to}`);
  console.log(line);

  for (const [label, metrics] of [
    ['IN-SAMPLE (70%)', split.inSample],
    ['OUT-OF-SAMPLE (30%)', split.outOfSample],
    ['ALL', split.all],
  ] as [string, BacktestMetrics][]) {
    if (metrics.totalTrades === 0) continue;
    console.log(`  ${label}`);
    printMetricsBlock(metrics, line);
  }

  console.log('\u2550'.repeat(52) + '\n');
}

function printMetricsBlock(metrics: BacktestMetrics, line: string): void {
  console.log(`  Trades:         ${metrics.totalTrades}`);
  console.log(`  Win Rate:        ${(metrics.winRate * 100).toFixed(1)}%`);
  console.log(`  Average R:       ${metrics.averageR >= 0 ? '+' : ''}${metrics.averageR.toFixed(2)}R`);
  console.log(`  Brier Score:     ${metrics.brierScore.toFixed(4)}`);
  console.log(`  Max Drawdown:    ${metrics.maxDrawdownR.toFixed(2)}R`);
  console.log(
    `  Profit Factor:   ${metrics.profitFactor === Infinity ? '\u221E' : metrics.profitFactor.toFixed(2)}`,
  );
  console.log(line);
}

function writeMarkdownReport(
  trades: SimulatedTrade[],
  split: SplitMetrics,
  options: ReportOptions,
): void {
  const lines: string[] = [];
  lines.push('# Backtest Report');
  lines.push('');
  lines.push('## Parameters');
  lines.push(`- **Symbol:** ${options.symbol}`);
  lines.push(`- **Timeframe:** ${options.timeframe}`);
  lines.push(`- **Period:** ${options.from} \u2192 ${options.to}`);
  lines.push(`- **Generated:** ${new Date().toISOString()}`);
  lines.push('');

  for (const [label, metrics] of [
    ['In-Sample (70%)', split.inSample],
    ['Out-of-Sample (30%)', split.outOfSample],
    ['All', split.all],
  ] as [string, BacktestMetrics][]) {
    if (metrics.totalTrades === 0) continue;
    lines.push(`## ${label}`);
    pushMetricsTable(lines, metrics);
    lines.push('');
  }

  lines.push('## Trades (first 20)');
  lines.push('| # | Time | Dir | Score | Prob | Outcome | Spread R | Sample |');
  lines.push('|---|------|-----|-------|------|---------|----------|--------|');
  const sample = trades.slice(0, 20);
  sample.forEach((t, idx) => {
    lines.push(
      `| ${idx + 1} | ${new Date(t.entryTime * 1000).toISOString().slice(0, 16)} | ${t.signal.direction} | ${t.signal.score} | ${(t.signal.calibratedProbability ?? 0).toFixed(2)} | ${t.outcome} | ${t.spreadCostR.toFixed(3)} | ${t.inSample ? 'IS' : 'OOS'} |`,
    );
  });
  if (trades.length > 20) {
    lines.push(`| ... | *${trades.length - 20} more trades in JSON output* | | | | | | |`);
  }
  lines.push('');

  const filepath = join(
    options.outputDir,
    `backtest-${options.symbol}-${options.timeframe}.md`,
  );
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, lines.join('\n'), 'utf-8');
  console.log(`  Markdown report: ${filepath}`);
}

function pushMetricsTable(lines: string[], m: BacktestMetrics): void {
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Trades | ${m.totalTrades} |`);
  lines.push(`| Wins | ${m.wins} |`);
  lines.push(`| Losses | ${m.losses} |`);
  lines.push(`| Timeouts | ${m.timeouts} |`);
  lines.push(`| Win Rate | ${(m.winRate * 100).toFixed(1)}% |`);
  lines.push(`| Average R | ${m.averageR >= 0 ? '+' : ''}${m.averageR.toFixed(2)}R |`);
  lines.push(`| Brier Score | ${m.brierScore.toFixed(4)} |`);
  lines.push(`| Max Drawdown | ${m.maxDrawdownR.toFixed(2)}R |`);
  lines.push(`| Profit Factor | ${m.profitFactor === Infinity ? '\u221E' : m.profitFactor.toFixed(2)} |`);
}

function writeJsonReport(
  trades: SimulatedTrade[],
  split: SplitMetrics,
  options: ReportOptions,
): void {
  const report = {
    parameters: {
      symbol: options.symbol,
      timeframe: options.timeframe,
      from: options.from,
      to: options.to,
      generatedAt: new Date().toISOString(),
    },
    metrics: {
      inSample: serializeMetrics(split.inSample),
      outOfSample: serializeMetrics(split.outOfSample),
      all: serializeMetrics(split.all),
    },
    trades: trades.map((t) => ({
      entryTime: t.entryTime,
      candleIndex: t.candleIndex,
      outcome: t.outcome,
      direction: t.signal.direction,
      score: t.signal.score,
      calibratedProbability: t.signal.calibratedProbability,
      entryPrice: t.signal.entryPrice,
      stopLoss: t.signal.stopLoss,
      takeProfit: t.signal.takeProfit,
      reason: t.signal.reason,
      pattern: t.signal.pattern,
      spreadCostR: t.spreadCostR,
      inSample: t.inSample,
      featureVector: t.signal.featureVector,
    })),
  };

  const filepath = join(
    options.outputDir,
    `backtest-${options.symbol}-${options.timeframe}.json`,
  );
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`  JSON report:     ${filepath}`);
}

function serializeMetrics(m: BacktestMetrics) {
  return { ...m, profitFactor: isFinite(m.profitFactor) ? m.profitFactor : null };
}
