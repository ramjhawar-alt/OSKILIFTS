import type { EntryData, ExerciseType, PrKind, SetData } from '../types/workout';
import { isWorkingSet } from './entry';
import type { Session } from './history';

/** Epley estimated one-rep max. Only meaningful for modest rep counts. */
export const E1RM_MAX_REPS = 12;
/** A new best must beat the old one by this much (kg) so unit rounding can't mint or erase PRs. */
export const PR_EPSILON_KG = 0.01;

export function e1rm(kg: number, reps: number): number {
  return reps <= 1 ? kg : kg * (1 + reps / 30);
}

export interface SetRecord {
  kg: number | null;
  reps: number | null;
  e1rm: number | null;
  date: string;
  workoutId: string;
}

export interface ExerciseRecords {
  /** Heaviest weight lifted for at least 1 rep (weight_reps / weighted bodyweight). */
  heaviest: SetRecord | null;
  /** Best estimated 1RM (sets of up to 12 reps). */
  bestE1rm: SetRecord | null;
  /** Most reps in one set (bodyweight exercises). */
  mostReps: SetRecord | null;
  /** Heaviest set by volume (kg x reps), shown as a stat, not a PR. */
  bestVolume: SetRecord | null;
  sessions: number;
  lastDate: string | null;
}

/** Sets that can count toward records: completed working sets with usable numbers. */
export function eligibleSets(entry: EntryData): SetData[] {
  return entry.sets.filter((set) => {
    if (!isWorkingSet(set) || set.reps === null || set.reps < 1) return false;
    if (entry.exercise.type === 'weight_reps') return set.kg !== null && set.kg > 0;
    return entry.exercise.type === 'bodyweight_reps';
  });
}

function better(current: number | null, candidate: number): boolean {
  return current === null || candidate > current + PR_EPSILON_KG;
}

export function computeRecords(sessions: Session[]): ExerciseRecords {
  const records: ExerciseRecords = {
    heaviest: null,
    bestE1rm: null,
    mostReps: null,
    bestVolume: null,
    sessions: sessions.length,
    lastDate: sessions.length > 0 ? sessions[0].date : null,
  };
  // Oldest first so an equal value keeps the EARLIEST achievement.
  for (const session of [...sessions].reverse()) {
    for (const set of eligibleSets(session.entry)) {
      const base = { date: session.date, workoutId: session.workoutId };
      const reps = set.reps as number;
      if (set.kg !== null) {
        const estimate = reps <= E1RM_MAX_REPS ? e1rm(set.kg, reps) : null;
        const record: SetRecord = { kg: set.kg, reps, e1rm: estimate, ...base };
        if (better(records.heaviest?.kg ?? null, set.kg)) records.heaviest = record;
        if (estimate !== null && better(records.bestE1rm?.e1rm ?? null, estimate)) records.bestE1rm = record;
        const volume = set.kg * reps;
        if (better(records.bestVolume ? (records.bestVolume.kg as number) * (records.bestVolume.reps as number) : null, volume)) {
          records.bestVolume = record;
        }
      }
      if (session.entry.exercise.type === 'bodyweight_reps' && (records.mostReps === null || reps > (records.mostReps.reps as number))) {
        records.mostReps = { kg: set.kg, reps, e1rm: null, ...base };
      }
    }
  }
  return records;
}

/**
 * Which records `entry` sets given everything logged before it. The first time
 * an exercise has any eligible set it is a baseline, not a PR, so a new user
 * doesn't get a badge on every lift.
 */
export function detectPrs(prior: Session[], entry: EntryData): PrKind[] {
  const type: ExerciseType = entry.exercise.type;
  if (type !== 'weight_reps' && type !== 'bodyweight_reps') return [];
  const now = eligibleSets(entry);
  if (now.length === 0) return [];

  const before = prior.flatMap((session) => eligibleSets(session.entry));
  if (before.length === 0) return [];

  const prs: PrKind[] = [];
  const weights = (sets: SetData[]) => sets.filter((s) => s.kg !== null).map((s) => s.kg as number);
  const estimates = (sets: SetData[]) =>
    sets.filter((s) => s.kg !== null && (s.reps as number) <= E1RM_MAX_REPS).map((s) => e1rm(s.kg as number, s.reps as number));
  const max = (values: number[]) => (values.length ? Math.max(...values) : null);

  const priorWeight = max(weights(before));
  const nowWeight = max(weights(now));
  if (nowWeight !== null && priorWeight !== null && nowWeight > priorWeight + PR_EPSILON_KG) prs.push('weight');

  const priorE1rm = max(estimates(before));
  const nowE1rm = max(estimates(now));
  if (nowE1rm !== null && priorE1rm !== null && nowE1rm > priorE1rm + PR_EPSILON_KG) prs.push('e1rm');

  if (type === 'bodyweight_reps') {
    const priorReps = Math.max(...before.map((s) => s.reps as number));
    const nowReps = Math.max(...now.map((s) => s.reps as number));
    if (nowReps > priorReps) prs.push('reps');
  }
  return prs;
}

// ---------------------------------------------------------------------------
// progress series (one point per day)
// ---------------------------------------------------------------------------
export type ProgressMetric = 'e1rm' | 'weight' | 'reps';

export interface ProgressPoint {
  date: string; // YYYY-MM-DD
  time: number; // ms (UTC midnight of date), for a time-scaled axis
  value: number; // kg for e1rm/weight, reps for reps
  workoutId: string;
  /** Higher than every earlier point. */
  isRecord: boolean;
}

export function metricsFor(type: ExerciseType): ProgressMetric[] {
  if (type === 'weight_reps') return ['e1rm', 'weight'];
  if (type === 'bodyweight_reps') return ['reps', 'weight'];
  return [];
}

export function progressSeries(sessions: Session[], metric: ProgressMetric): ProgressPoint[] {
  const byDate = new Map<string, { value: number; workoutId: string }>();
  for (const session of sessions) {
    for (const set of eligibleSets(session.entry)) {
      let value: number | null = null;
      if (metric === 'reps') value = set.reps;
      else if (set.kg !== null) {
        value = metric === 'weight' ? set.kg : (set.reps as number) <= E1RM_MAX_REPS ? e1rm(set.kg, set.reps as number) : null;
      }
      if (value === null) continue;
      const existing = byDate.get(session.date);
      if (!existing || value > existing.value) byDate.set(session.date, { value, workoutId: session.workoutId });
    }
  }
  const points: ProgressPoint[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, { value, workoutId }]) => ({
      date,
      time: Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))),
      value,
      workoutId,
      isRecord: false,
    }));
  let best = -Infinity;
  for (const point of points) {
    if (point.value > best + (metric === 'reps' ? 0 : PR_EPSILON_KG)) {
      point.isRecord = best !== -Infinity;
      best = point.value;
    }
  }
  return points;
}
