export function nullArray(len: number): (number | null)[] {
  return Array.from({ length: len }, () => null);
}

export function zeroArray(len: number): number[] {
  return Array.from({ length: len }, () => 0);
}

export function lastNonNull(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null) return values[i];
  }
  return null;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function zipTime(
  candles: { time: number }[],
  values: (number | null)[],
): Array<{ time: number; value: number | null }> {
  return candles.map((c, i) => ({ time: c.time, value: values[i] ?? null }));
}
