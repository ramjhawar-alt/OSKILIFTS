import type { EntryData, SetData } from '../types/workout';
import { isWorkingSet, legacyProjection } from './entry';
import {
  formatDistance,
  formatDuration,
  formatWeightValue,
  type WeightUnit,
} from './units';

// Builds a local Date from the YYYY-MM-DD part of an ISO string so the shown
// day never shifts with the viewer's timezone (workouts are stored at noon UTC).
export function getDateFromISOString(isoString: string): Date {
  const datePart = isoString.split('T')[0];
  return getDateFromDateString(datePart);
}

export function getDateFromDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatReps(reps: number | number[]): string {
  return Array.isArray(reps) ? reps.join(', ') : String(reps);
}

/** One logged set as text, e.g. "135×8", "+25×8", "12", "25:00", "1.5 mi in 25:00". */
export function formatSet(set: SetData, type: EntryData['exercise']['type'], unit: WeightUnit): string {
  switch (type) {
    case 'duration':
      return set.sec !== null ? formatDuration(set.sec) : '—';
    case 'distance_duration': {
      const distance = set.m !== null ? formatDistance(set.m, unit) : null;
      const time = set.sec !== null ? formatDuration(set.sec) : null;
      if (distance && time) return `${distance} in ${time}`;
      return distance ?? time ?? '—';
    }
    case 'bodyweight_reps': {
      const reps = set.reps !== null ? String(set.reps) : '—';
      return set.kg !== null ? `+${formatWeightValue(set.kg, unit)}×${reps}` : reps;
    }
    default: {
      if (set.kg !== null && set.reps !== null) return `${formatWeightValue(set.kg, unit)}×${set.reps}`;
      if (set.reps !== null) return `${set.reps} reps`;
      if (set.kg !== null) return formatWeightValue(set.kg, unit);
      return '—';
    }
  }
}

/**
 * Compact one-line summary of an entry. Legacy entries render exactly as they
 * always have ("3 sets × 8, 8, 6 reps"); v2 entries list each working set.
 */
export function formatExerciseEntry(entry: EntryData, unit: WeightUnit = 'lb'): string {
  if (entry.legacy && !entry.touched) {
    return `${entry.legacy.sets} sets × ${formatReps(entry.legacy.reps)} reps`;
  }
  const type = entry.exercise.type;
  const working = entry.sets.filter(isWorkingSet);
  const warmups = entry.sets.length - working.length;
  if (working.length === 0 && warmups === 0) return 'No sets';
  const parts = working.map((set) => formatSet(set, type, unit));
  let text = parts.join(', ');
  const hasWeight = working.some((set) => set.kg !== null);
  if (hasWeight && (type === 'weight_reps' || type === 'bodyweight_reps')) text += ` ${unit}`;
  if (warmups > 0) text += ` (+${warmups} warm-up${warmups === 1 ? '' : 's'})`;
  return text || `${warmups} warm-up${warmups === 1 ? '' : 's'}`;
}

/** Number of sets worth showing as "N sets" (working sets; legacy uses its own count). */
export function workingSetCount(entry: EntryData): number {
  return legacyProjection(entry).sets;
}
