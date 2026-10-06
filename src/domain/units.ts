export type WeightUnit = 'lb' | 'kg';

export const KG_PER_LB = 0.45359237; // exact
export const MAX_KG = 1500;
const M_PER_MILE = 1609.344;

/** Weights are stored in kg, rounded to 4 decimals (error <= 5e-5 kg ~ 1.1e-4 lb). */
export function roundKg(kg: number): number {
  return Math.round(kg * 1e4) / 1e4;
}

export function lbToKg(lb: number): number {
  return roundKg(lb * KG_PER_LB);
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function toDisplayValue(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : kg;
}

function trimZeros(fixed: string): string {
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/**
 * Number-only display of a stored kg weight in the viewer's unit. Values that
 * sit on a 2-decimal grid (135, 2.5, 1.25, 0.25) print exactly; anything else
 * (e.g. 60 kg shown in lb) gets 1 decimal for lb and 2 for kg.
 */
export function formatWeightValue(kg: number, unit: WeightUnit): string {
  const value = toDisplayValue(kg, unit);
  const grid = Math.round(value * 100) / 100;
  if (Math.abs(value - grid) <= 0.0005) return trimZeros(grid.toFixed(2));
  return trimZeros(value.toFixed(unit === 'lb' ? 1 : 2));
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${formatWeightValue(kg, unit)} ${unit}`;
}

const WEIGHT_PATTERN = /^(\d+([.,]\d{1,2})?|[.,]\d{1,2})$/;

/**
 * Parses what a user typed (in `unit`) into kg. Accepts a comma or period
 * decimal separator and up to 2 decimals. null for empty/invalid/zero/too heavy.
 */
export function parseWeightInput(text: string, unit: WeightUnit): number | null {
  const trimmed = text.trim();
  if (!WEIGHT_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const kg = unit === 'lb' ? lbToKg(value) : roundKg(value);
  return kg > MAX_KG || kg <= 0 ? null : kg;
}

/** Text to prefill an input with for a stored kg weight. */
export function weightInputText(kg: number | null, unit: WeightUnit): string {
  return kg === null ? '' : formatWeightValue(kg, unit);
}

// ---------------------------------------------------------------------------
// distance (stored in meters; lb users see miles, kg users see km)
// ---------------------------------------------------------------------------
export function formatDistance(meters: number, unit: WeightUnit): string {
  const value = unit === 'lb' ? meters / M_PER_MILE : meters / 1000;
  const text = trimZeros(value.toFixed(2));
  return `${text} ${unit === 'lb' ? 'mi' : 'km'}`;
}

export function parseDistanceInput(text: string, unit: WeightUnit): number | null {
  const trimmed = text.trim();
  if (!WEIGHT_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  const meters = Math.round(value * (unit === 'lb' ? M_PER_MILE : 1000) * 100) / 100;
  return meters > 1_000_000 ? null : meters;
}

// ---------------------------------------------------------------------------
// duration (stored as whole seconds)
// ---------------------------------------------------------------------------
export function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "90" = 90 s, "1:30" = 90 s, "1:02:03" = 3723 s. */
export function parseDurationInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map(Number);
  let seconds = 0;
  if (parts.length === 1) seconds = parts[0];
  else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
  else seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length > 1 && parts[parts.length - 1] > 59) return null;
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}
