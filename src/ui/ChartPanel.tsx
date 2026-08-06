import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type IPriceLine,
  type Time,
} from 'lightweight-charts';
import type { Candle, IndicatorSnapshot, IndicatorSeries, SeriesPoint } from '@/types/market';
import { useSettingsStore } from '@/stores/settingsStore';
import { findSymbol } from '@/data/symbols';
import { computeStructure } from '@/compute/indicators/trend-structure';
import { supportResistance } from '@/compute/indicators/support-resistance';
import { ema } from '@/compute/indicators/ema';
import { macd } from '@/compute/indicators/macd';
import { calcSmartMoney } from '@/compute/indicators/smart-money';
import { BoxOverlayPrimitive, type ChartBoxData } from '@/ui/BoxOverlayPrimitive';
import { clsx } from '@/lib/utils';

interface ChartPanelProps {
  candles: Candle[];
  snapshot: IndicatorSnapshot | null;
  series: IndicatorSeries | null;
}

interface ChartDataState {
  lastCandleTime: number | null;
  candleCount: number;
}

function toLineData(candles: Candle[], values: (number | null)[]): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = 0; i < candles.length && i < values.length; i++) {
    const v = values[i];
    if (v !== null && !Number.isNaN(v)) {
      result.push({ time: candles[i].time as Time, value: v });
    }
  }
  return result;
}

function seriesToLineData(points: SeriesPoint[]): { time: Time; value: number }[] {
  return points
    .filter((p) => p.value !== null && !Number.isNaN(p.value))
    .map((p) => ({ time: p.time as Time, value: p.value as number }));
}

export function ChartPanel({ candles, series }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bollUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const boxPrimitiveRef = useRef<BoxOverlayPrimitive | null>(null);
  const srPriceLinesRef = useRef<IPriceLine[]>([]);
  const bosPriceLinesRef = useRef<IPriceLine[]>([]);
  const dataStateRef = useRef<ChartDataState>({ lastCandleTime: null, candleCount: 0 });
  const symbolId = useSettingsStore((s) => s.symbolId);
  const timeframe = useSettingsStore((s) => s.timeframe);
  const showBosLayer = useSettingsStore((s) => s.showBosLayer);
  const showOrderBlocks = useSettingsStore((s) => s.showOrderBlocks);
  const showImbalances = useSettingsStore((s) => s.showImbalances);
  const showSupportResistance = useSettingsStore((s) => s.showSupportResistance);
  const showEma20 = useSettingsStore((s) => s.showEma20);
  const showEma50 = useSettingsStore((s) => s.showEma50);
  const showEma200 = useSettingsStore((s) => s.showEma200);
  const showBollinger = useSettingsStore((s) => s.showBollinger);
  const showMacd = useSettingsStore((s) => s.showMacd);
  const showRejectionBlocks = useSettingsStore((s) => s.showRejectionBlocks);
  const symbol = findSymbol(symbolId);

  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const ema20Data = useMemo(() => ema(closes, 20), [closes]);
  const ema50Data = useMemo(() => ema(closes, 50), [closes]);
  const ema200Data = useMemo(() => ema(closes, 200), [closes]);
  const macdData = useMemo(() => macd(closes, 12, 26, 9), [closes]);
  const smartMoney = useMemo(() => calcSmartMoney(candles), [candles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0e17' },
        textColor: '#8294b0',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(62, 72, 93, 0.25)' },
        horzLines: { color: 'rgba(62, 72, 93, 0.25)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3385ff', width: 1, style: 2 },
        horzLine: { color: '#3385ff', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: '#272f40' },
      timeScale: { borderColor: '#272f40', timeVisible: true, secondsVisible: false },
      width: container.clientWidth,
      height: container.clientHeight,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    const primitive = new BoxOverlayPrimitive();
    candleSeries.attachPrimitive(primitive);
    boxPrimitiveRef.current = primitive;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: 'rgba(130, 148, 176, 0.4)',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const ema20 = chart.addSeries(LineSeries, {
      color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    ema20Ref.current = ema20;

    const ema50 = chart.addSeries(LineSeries, {
      color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    ema50Ref.current = ema50;

    const ema200 = chart.addSeries(LineSeries, {
      color: '#a855f7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    ema200Ref.current = ema200;

    const bollUpper = chart.addSeries(LineSeries, {
      color: 'rgba(51, 133, 255, 0.5)', lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
    });
    bollUpperRef.current = bollUpper;

    const bollLower = chart.addSeries(LineSeries, {
      color: 'rgba(51, 133, 255, 0.5)', lineWidth: 1, lineStyle: 2,
      priceLineVisible: false, lastValueVisible: false,
    });
    bollLowerRef.current = bollLower;

    const macdHist = chart.addSeries(HistogramSeries, {
      color: '#22c55e', priceScaleId: 'macd',
      priceLineVisible: false, lastValueVisible: false,
    });
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    macdHistRef.current = macdHist;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
      boxPrimitiveRef.current?.updateAllViews();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (boxPrimitiveRef.current && candleSeriesRef.current) {
        candleSeriesRef.current.detachPrimitive(boxPrimitiveRef.current);
      }
      boxPrimitiveRef.current = null;
      for (const line of srPriceLinesRef.current) {
        candleSeriesRef.current?.removePriceLine(line);
      }
      srPriceLinesRef.current = [];
      for (const line of bosPriceLinesRef.current) {
        candleSeriesRef.current?.removePriceLine(line);
      }
      bosPriceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      bollUpperRef.current = null;
      bollLowerRef.current = null;
      macdHistRef.current = null;
      markersRef.current = null;
      dataStateRef.current = { lastCandleTime: null, candleCount: 0 };
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) {
      dataStateRef.current = { lastCandleTime: null, candleCount: 0 };
      return;
    }

    const ds = dataStateRef.current;
    const lastCandle = candles[candles.length - 1];

    if (ds.lastCandleTime === null || ds.candleCount === 0 || candles.length < ds.candleCount) {
      const candleData = candles.map((c) => ({
        time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      const volumeData = candles.map((c) => ({
        time: c.time as Time, value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }));
      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      ds.lastCandleTime = lastCandle.time;
      ds.candleCount = candles.length;
      return;
    }

    candleSeriesRef.current.update({
      time: lastCandle.time as Time, open: lastCandle.open, high: lastCandle.high,
      low: lastCandle.low, close: lastCandle.close,
    });
    volumeSeriesRef.current.update({
      time: lastCandle.time as Time, value: lastCandle.volume,
      color: lastCandle.close >= lastCandle.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    });
    if (lastCandle.time > ds.lastCandleTime) {
      ds.lastCandleTime = lastCandle.time;
      ds.candleCount = candles.length;
    }
  }, [candles]);

  useEffect(() => {
    ema20Ref.current?.setData(showEma20 ? toLineData(candles, ema20Data) : []);
  }, [candles, ema20Data, showEma20]);

  useEffect(() => {
    ema50Ref.current?.setData(showEma50 ? toLineData(candles, ema50Data) : []);
  }, [candles, ema50Data, showEma50]);

  useEffect(() => {
    ema200Ref.current?.setData(showEma200 ? toLineData(candles, ema200Data) : []);
  }, [candles, ema200Data, showEma200]);

  useEffect(() => {
    if (showBollinger && series) {
      bollUpperRef.current?.setData(seriesToLineData(series.bollingerUpper));
      bollLowerRef.current?.setData(seriesToLineData(series.bollingerLower));
    } else {
      bollUpperRef.current?.setData([]);
      bollLowerRef.current?.setData([]);
    }
  }, [series, showBollinger]);

  useEffect(() => {
    if (!macdHistRef.current) return;
    if (!showMacd || candles.length === 0) {
      macdHistRef.current.setData([]);
      return;
    }
    const histData = macdData.histogram
      .map((v, i) => ({
        time: candles[i].time as Time,
        value: v,
        color: v !== null && v >= 0 ? '#22c55e' : '#ef4444',
      }))
      .filter((d) => d.value !== null && !Number.isNaN(d.value));
    macdHistRef.current.setData(histData);
  }, [candles, macdData, showMacd]);

  useEffect(() => {
    if (!boxPrimitiveRef.current) return;
    if (candles.length < 10) {
      boxPrimitiveRef.current.setBoxes([]);
      return;
    }

    const boxes: ChartBoxData[] = [];

    if (showOrderBlocks) {
      for (const ob of smartMoney.orderBlocks) {
        boxes.push({
          id: `ob_${ob.time}_${ob.type}`,
          fromTime: ob.time,
          toTime: ob.mitigated ? ob.endTime : null,
          topPrice: ob.top,
          bottomPrice: ob.bottom,
          fillColor: ob.type === 'bullish'
            ? (ob.mitigated ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.18)')
            : (ob.mitigated ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.18)'),
          borderColor: ob.type === 'bullish' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
          label: 'OB',
        });
      }
    }

    if (showImbalances) {
      for (const fvg of smartMoney.fvgs) {
        boxes.push({
          id: `fvg_${fvg.time}_${fvg.type}`,
          fromTime: fvg.time,
          toTime: fvg.broken ? fvg.endTime : null,
          topPrice: fvg.top,
          bottomPrice: fvg.bottom,
          fillColor: fvg.type === 'bullish' ? 'rgba(6,182,212,0.12)' : 'rgba(249,115,22,0.12)',
          borderColor: fvg.type === 'bullish' ? 'rgba(6,182,212,0.5)' : 'rgba(249,115,22,0.5)',
          label: 'FVG',
        });
      }
    }

    if (showRejectionBlocks) {
      for (const rb of smartMoney.rejectionBlocks) {
        boxes.push({
          id: `rjb_${rb.time}_${rb.type}`,
          fromTime: rb.time,
          toTime: null,
          topPrice: rb.top,
          bottomPrice: rb.bottom,
          fillColor: rb.type === 'bullish' ? 'rgba(45,212,191,0.15)' : 'rgba(244,114,182,0.15)',
          borderColor: rb.type === 'bullish' ? 'rgba(45,212,191,0.55)' : 'rgba(244,114,182,0.55)',
          label: 'RJB',
        });
      }
    }

    boxPrimitiveRef.current.setBoxes(boxes);
  }, [candles, smartMoney, showBosLayer, showOrderBlocks, showImbalances, showRejectionBlocks]);

  useEffect(() => {
    if (!candleSeriesRef.current || !markersRef.current) return;
    if (!showBosLayer || candles.length === 0) {
      if (markersRef.current) markersRef.current.setMarkers([]);
      return;
    }
    const structure = computeStructure(candles);
    const markers: SeriesMarker<Time>[] = [];
    const last = candles[candles.length - 1];
    if (structure.bos) {
      markers.push({ time: last.time as Time, position: 'belowBar', color: '#1de6c2', shape: 'arrowUp', text: 'BOS' });
    }
    if (structure.choch) {
      markers.push({ time: last.time as Time, position: 'aboveBar', color: '#f59e0b', shape: 'arrowDown', text: 'CHOCH' });
    }
    markersRef.current.setMarkers(markers);
  }, [candles, showBosLayer]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    for (const line of bosPriceLinesRef.current) {
      candleSeriesRef.current.removePriceLine(line);
    }
    bosPriceLinesRef.current = [];
    if (!showBosLayer || candles.length < 10) return;
    for (const bos of smartMoney.bosEvents.slice(-5)) {
      const pl = candleSeriesRef.current.createPriceLine({
        price: bos.price,
        color: bos.type === 'bullish' ? '#22c55e88' : '#ef444488',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BoS',
      });
      bosPriceLinesRef.current.push(pl);
    }
  }, [candles, smartMoney, showBosLayer]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    for (const line of srPriceLinesRef.current) {
      candleSeriesRef.current.removePriceLine(line);
    }
    srPriceLinesRef.current = [];
    if (!showSupportResistance || candles.length < 20) return;
    const levels = supportResistance(candles).slice(0, 6);
    for (const level of levels) {
      const isSupport = level.type === 'support';
      const line = candleSeriesRef.current.createPriceLine({
        price: level.price,
        color: isSupport ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: isSupport ? `S (${level.touches})` : `R (${level.touches})`,
      });
      srPriceLinesRef.current.push(line);
    }
  }, [candles, showSupportResistance]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {symbol && (
        <div className="pointer-events-none absolute left-3 top-2 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-base-300">
            <span className="text-base-100">{symbol.displaySymbol}</span>
            <span className="text-base-400">·</span>
            <span className={clsx('text-base-400', !timeframe && 'text-base-500')}>{timeframe}</span>
            {showBosLayer && (
              <span className="ml-1 rounded bg-secondary-700/30 px-1.5 py-0.5 text-2xs font-bold uppercase text-secondary-400">
                BOS
              </span>
            )}
          </div>
          {showBosLayer && (showOrderBlocks || showImbalances || showRejectionBlocks) && (
            <div className="flex flex-wrap gap-1.5 text-2xs font-semibold uppercase">
              {showOrderBlocks && (
                <span className="flex items-center gap-1 rounded bg-base-900/70 px-1.5 py-0.5 text-success-400">
                  <span className="h-2 w-2 rounded-sm bg-success-500/50" /> OB
                </span>
              )}
              {showImbalances && (
                <span className="flex items-center gap-1 rounded bg-base-900/70 px-1.5 py-0.5 text-secondary-400">
                  <span className="h-2 w-2 rounded-sm bg-secondary-500/50" /> FVG
                </span>
              )}
              {showRejectionBlocks && (
                <span className="flex items-center gap-1 rounded bg-base-900/70 px-1.5 py-0.5 text-teal-400">
                  <span className="h-2 w-2 rounded-sm bg-teal-500/50" /> RJB
                </span>
              )}
            </div>
          )}
          {(showEma20 || showEma50 || showEma200) && (
            <div className="flex flex-wrap gap-1.5 text-2xs font-semibold uppercase">
              {showEma20 && (
                <span className="flex items-center gap-1 rounded bg-base-900/70 px-1.5 py-0.5 text-amber-400">
                  <span className="h-2 w-2 rounded-sm bg-amber-500/50" /> EMA20
                </span>
              )}
              {showEma50 && (
                <span className="flex items-center gap-1 rounded bg-base-900/70 px-1.5 py-0.5 text-blue-400">
                  <span className="h-2 w-2 rounded-sm bg-blue-500/50" /> EMA50
                </span>
              )}
              {showEma200 && (
                <span className="flex items-center gap-1 rounded bg-base-900/70 px-1.5 py-0.5 text-purple-400">
                  <span className="h-2 w-2 rounded-sm bg-purple-500/50" /> EMA200
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
