import { describe, it, expect } from 'vitest';
import { calcSmartMoney } from '@/compute/indicators/smart-money';
import type { Candle } from '@/types/domain';

function candle(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000,
): Candle {
  return { time, open, high, low, close, volume };
}

describe('detectOrderBlocks (calcSmartMoney.orderBlocks)', () => {
  it('returns empty for insufficient candles', () => {
    const result = calcSmartMoney([candle(1, 100, 101, 99, 100)]);
    expect(result.orderBlocks).toEqual([]);
  });

  it('detects bullish order block after down candle + breakout up', () => {
    const candles: Candle[] = [];
    let t = 1700000000;
    for (let i = 0; i < 10; i++) {
      candles.push(candle(t, 100, 101, 99, 99, 1000));
      t += 60;
    }
    candles.push(candle(t, 99, 98, 97, 97.5, 1000));
    t += 60;
    candles.push(candle(t, 97.5, 103, 97, 102, 1500));
    t += 60;
    for (let i = 0; i < 5; i++) {
      candles.push(candle(t, 102, 103, 101, 102.5, 1000));
      t += 60;
    }
    const result = calcSmartMoney(candles);
    expect(result.orderBlocks.length).toBeGreaterThan(0);
    const bullOB = result.orderBlocks.find((ob) => ob.type === 'bullish');
    expect(bullOB).toBeDefined();
    expect(bullOB!.top).toBeGreaterThan(bullOB!.bottom);
  });

  it('detects bearish order block after up candle + breakout down', () => {
    const candles: Candle[] = [];
    let t = 1700000000;
    for (let i = 0; i < 10; i++) {
      candles.push(candle(t, 100, 101, 99, 100.5, 1000));
      t += 60;
    }
    candles.push(candle(t, 100.5, 102, 100, 102, 1000));
    t += 60;
    candles.push(candle(t, 102, 102, 96, 97, 1500));
    t += 60;
    for (let i = 0; i < 5; i++) {
      candles.push(candle(t, 97, 98, 96, 96.5, 1000));
      t += 60;
    }
    const result = calcSmartMoney(candles);
    const bearOB = result.orderBlocks.find((ob) => ob.type === 'bearish');
    expect(bearOB).toBeDefined();
    expect(bearOB!.top).toBeGreaterThan(bearOB!.bottom);
  });
});

describe('detectFVGs (calcSmartMoney.fvgs)', () => {
  it('returns empty for insufficient candles', () => {
    const result = calcSmartMoney([candle(1, 100, 101, 99, 100)]);
    expect(result.fvgs).toEqual([]);
  });

  it('detects bullish FVG when gap up exists', () => {
    const candles: Candle[] = [];
    let t = 1700000000;
    for (let i = 0; i < 10; i++) {
      candles.push(candle(t, 100, 101, 99, 100, 1000));
      t += 60;
    }
    candles.push(candle(t, 100, 101, 99, 100, 1000));
    t += 60;
    candles.push(candle(t, 102, 105, 102, 104, 1000));
    t += 60;
    for (let i = 0; i < 5; i++) {
      candles.push(candle(t, 104, 105, 103, 104, 1000));
      t += 60;
    }
    const result = calcSmartMoney(candles);
    const bullFvg = result.fvgs.find((f) => f.type === 'bullish');
    expect(bullFvg).toBeDefined();
    expect(bullFvg!.top).toBeGreaterThan(bullFvg!.bottom);
  });

  it('detects bearish FVG when gap down exists', () => {
    const candles: Candle[] = [];
    let t = 1700000000;
    for (let i = 0; i < 10; i++) {
      candles.push(candle(t, 100, 101, 99, 100, 1000));
      t += 60;
    }
    candles.push(candle(t, 100, 101, 99, 100, 1000));
    t += 60;
    candles.push(candle(t, 98, 98, 95, 96, 1000));
    t += 60;
    for (let i = 0; i < 5; i++) {
      candles.push(candle(t, 96, 97, 95, 96, 1000));
      t += 60;
    }
    const result = calcSmartMoney(candles);
    const bearFvg = result.fvgs.find((f) => f.type === 'bearish');
    expect(bearFvg).toBeDefined();
    expect(bearFvg!.top).toBeGreaterThan(bearFvg!.bottom);
  });
});
