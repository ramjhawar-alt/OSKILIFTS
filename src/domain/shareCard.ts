import type { EntryData, SetData } from '../types/workout';
import { isWorkingSet, legacyProjection } from './entry';
import { formatExerciseEntry, formatSet } from './format';
import { toDisplayValue, type WeightUnit } from './units';

export const SHARE_CARD_MAX_LINES = 5;
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

const MAX_TITLE_CHARS = 26;
const MAX_NAME_CHARS = 28;

export interface ShareCardLine {
  name: string;
  detail: string;
  pr: boolean;
}

export interface ShareCardStat {
  label: string;
  value: string;
}

export interface ShareCardModel {
  title: string;
  dateLabel: string;
  handle: string | null;
  lines: ShareCardLine[];
  moreCount: number;
  stats: ShareCardStat[];
  prCount: number;
  bearStage: number;
  filename: string;
}

export interface ShareCardInput {
  workout: { date: string; dayType: { name: string }; exercises: EntryData[] };
  unit: WeightUnit;
  username?: string | null;
  bearStage: number;
}

/** Clips by code point (never splits an emoji) and marks the cut with an ellipsis. */
export function clip(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join('');
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

function dateParts(isoDate: string): { label: string; slug: string } {
  const [year, month, day] = isoDate.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return { label: '', slug: 'workout' };
  return {
    label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    slug: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function bestSet(sets: SetData[], type: EntryData['exercise']['type']): SetData {
  const score = (set: SetData): number => {
    switch (type) {
      case 'duration':
        return set.sec ?? -1;
      case 'distance_duration':
        return set.m ?? -1;
      case 'bodyweight_reps':
        return (set.reps ?? -1) * 1e6 + (set.kg ?? 0);
      default:
        return (set.kg ?? -1) * 1e4 + (set.reps ?? 0);
    }
  };
  return sets.reduce((best, set) => (score(set) > score(best) ? set : best), sets[0]);
}

function describeEntry(entry: EntryData, unit: WeightUnit): string {
  // Untouched legacy entries keep their original wording.
  if (entry.legacy && !entry.touched) return formatExerciseEntry(entry, unit);

  const working = entry.sets.filter(isWorkingSet);
  if (working.length === 0) return entry.sets.length > 0 ? 'Warm-up only' : 'No sets';

  const type = entry.exercise.type;
  const top = bestSet(working, type);
  let text = formatSet(top, type, unit);
  if (top.kg !== null && (type === 'weight_reps' || type === 'bodyweight_reps')) text += ` ${unit}`;
  if (working.length === 1) return text;
  return `${working.length} sets · top ${text}`;
}

/** Total weight moved by working sets, in kg. */
function volumeKg(entries: EntryData[]): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.legacy && !entry.touched) continue; // legacy sets carry no weight
    if (entry.exercise.type !== 'weight_reps') continue;
    for (const set of entry.sets) {
      if (isWorkingSet(set) && set.kg !== null && set.reps !== null) total += set.kg * set.reps;
    }
  }
  return total;
}

function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function buildShareCard({ workout, unit, username, bearStage }: ShareCardInput): ShareCardModel {
  const { label, slug } = dateParts(workout.date);
  const entries = workout.exercises;

  const lines = entries.slice(0, SHARE_CARD_MAX_LINES).map((entry) => ({
    name: clip(entry.exercise.name, MAX_NAME_CHARS),
    detail: describeEntry(entry, unit),
    pr: entry.prs.length > 0,
  }));

  const setCount = entries.reduce((sum, entry) => sum + legacyProjection(entry).sets, 0);
  const prCount = entries.filter((entry) => entry.prs.length > 0).length;
  const volume = volumeKg(entries);

  const stats: ShareCardStat[] = [{ label: entries.length === 1 ? 'Exercise' : 'Exercises', value: String(entries.length) }];
  if (setCount > 0) stats.push({ label: setCount === 1 ? 'Set' : 'Sets', value: String(setCount) });
  if (volume > 0) {
    stats.push({ label: `Volume (${unit})`, value: groupThousands(toDisplayValue(volume, unit)) });
  }
  if (prCount > 0) stats.push({ label: prCount === 1 ? 'New PR' : 'New PRs', value: String(prCount) });

  const titleSlug = workout.dayType.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return {
    title: clip(workout.dayType.name, MAX_TITLE_CHARS) || 'Workout',
    dateLabel: label,
    handle: username ? `@${username}` : null,
    lines,
    moreCount: Math.max(0, entries.length - lines.length),
    stats: stats.slice(0, 4),
    prCount,
    bearStage,
    filename: `oskilifts-${slug}${titleSlug ? `-${titleSlug}` : ''}.png`,
  };
}
