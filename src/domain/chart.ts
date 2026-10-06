import type { ProgressPoint } from './prs';

/** ~count "nice" tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  const step = (residual >= 5 ? 5 : residual >= 2 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value < max + step; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
    if (ticks.length > 12) break;
  }
  return ticks;
}

export type Range = '3M' | '6M' | '1Y' | 'All';
const RANGE_DAYS: Record<Exclude<Range, 'All'>, number> = { '3M': 92, '6M': 183, '1Y': 365 };

export function filterRange(points: ProgressPoint[], range: Range, now: number): ProgressPoint[] {
  if (range === 'All') return points;
  const cutoff = now - RANGE_DAYS[range] * 86_400_000;
  return points.filter((p) => p.time >= cutoff);
}

export interface Padding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  source: ProgressPoint;
}

export interface ChartModel {
  points: ChartPoint[];
  yTicks: { value: number; y: number }[];
  xLabels: { time: number; x: number }[];
}

export function buildChartModel(
  data: ProgressPoint[],
  width: number,
  height: number,
  padding: Padding,
  xLabelCount = 3,
): ChartModel {
  if (data.length === 0 || width <= 0 || height <= 0) return { points: [], yTicks: [], xLabels: [] };
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);

  const values = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const yOf = (value: number) => padding.top + innerH - ((value - yMin) / (yMax - yMin || 1)) * innerH;

  const tMin = data[0].time;
  const tMax = data[data.length - 1].time;
  const xOf = (time: number) =>
    data.length === 1 || tMax === tMin ? padding.left + innerW / 2 : padding.left + ((time - tMin) / (tMax - tMin)) * innerW;

  const labelTimes =
    data.length === 1 || tMax === tMin
      ? [tMin]
      : Array.from({ length: xLabelCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xLabelCount - 1));

  return {
    points: data.map((d) => ({ x: xOf(d.time), y: yOf(d.value), source: d })),
    yTicks: ticks.map((value) => ({ value, y: yOf(value) })),
    xLabels: labelTimes.map((time) => ({ time, x: xOf(time) })),
  };
}
