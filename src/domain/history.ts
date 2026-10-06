import type { EntryData, SetData, Workout } from '../types/workout';
import { isWorkingSet } from './entry';
import { distanceInputText, formatDuration, weightInputText, type WeightUnit } from './units';
import type { RowKind } from './draft';

export interface Session {
  workoutId: string;
  /** YYYY-MM-DD */
  date: string;
  createdAt: string;
  entry: EntryData;
}

/** exerciseKey -> sessions, newest first (by date, then createdAt). */
export type HistoryIndex = Map<string, Session[]>;

const FAR_FUTURE = '9999-12-31T23:59:59.999Z';

function compareSessions(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1; // newer first
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return 0;
}

export function buildHistoryIndex(workouts: Workout[]): HistoryIndex {
  const index: HistoryIndex = new Map();
  for (const workout of workouts) {
    const date = workout.date.split('T')[0];
    const createdAt = workout.createdAt ?? `${date}T12:00:00.000Z`;
    for (const entry of workout.exercises) {
      if (entry.sets.length === 0) continue;
      const list = index.get(entry.key) ?? [];
      list.push({ workoutId: workout.id, date, createdAt, entry });
      index.set(entry.key, list);
    }
  }
  for (const list of index.values()) list.sort(compareSessions);
  return index;
}

/**
 * The most recent session of an exercise strictly before (date, createdAt),
 * ignoring `excludeWorkoutId` (the workout being edited).
 */
export function lastPerformance(
  index: HistoryIndex,
  key: string,
  before: { date: string; createdAt?: string },
  excludeWorkoutId?: string,
): Session | undefined {
  const sessions = index.get(key);
  if (!sessions) return undefined;
  const beforeCreated = before.createdAt ?? FAR_FUTURE;
  return sessions.find((session) => {
    if (excludeWorkoutId && session.workoutId === excludeWorkoutId) return false;
    if (session.date !== before.date) return session.date < before.date;
    return session.createdAt < beforeCreated;
  });
}

/** Every session of an exercise strictly before (date, createdAt), excluding one workout. */
export function sessionsBefore(
  index: HistoryIndex,
  key: string,
  before: { date: string; createdAt?: string },
  excludeWorkoutId?: string,
): Session[] {
  const beforeCreated = before.createdAt ?? FAR_FUTURE;
  return (index.get(key) ?? []).filter((session) => {
    if (excludeWorkoutId && session.workoutId === excludeWorkoutId) return false;
    if (session.date !== before.date) return session.date < before.date;
    return session.createdAt < beforeCreated;
  });
}

// ---------------------------------------------------------------------------
// hints for set rows
// ---------------------------------------------------------------------------
export interface SetHint {
  weightText: string;
  repsText: string;
  secText: string;
  distText: string;
  /** Short text for the PREVIOUS column, e.g. "135×8", "BW×12", "25:00". */
  summary: string;
}

export function setHintFrom(
  set: SetData,
  type: EntryData['exercise']['type'],
  unit: WeightUnit,
): SetHint {
  const weightText = weightInputText(set.kg, unit);
  const repsText = set.reps === null ? '' : String(set.reps);
  const secText = set.sec === null ? '' : formatDuration(set.sec);
  const distText = distanceInputText(set.m, unit);
  let summary: string;
  if (type === 'duration') summary = secText || '—';
  else if (type === 'distance_duration') summary = [distText, secText].filter(Boolean).join(' · ') || '—';
  else if (type === 'bodyweight_reps') summary = weightText ? `+${weightText}×${repsText || '?'}` : repsText ? `BW×${repsText}` : '—';
  else if (weightText && repsText) summary = `${weightText}×${repsText}`;
  else summary = repsText ? `${repsText} reps` : weightText || '—';
  return { weightText, repsText, secText, distText, summary };
}

const isWarmupKind = (kind: RowKind | SetData['kind']) => kind === 'warmup';

/**
 * Hint for a draft row. Warm-ups line up with the previous session's warm-ups
 * and working sets with its working sets, by position within the class. Rows
 * past the previous count reuse the last working set.
 */
export function hintForRow(
  previous: SetData[],
  rows: { kind: RowKind }[],
  rowIndex: number,
  type: EntryData['exercise']['type'],
  unit: WeightUnit,
): SetHint | null {
  const warm = isWarmupKind(rows[rowIndex].kind);
  const ordinal = rows.slice(0, rowIndex).filter((r) => isWarmupKind(r.kind) === warm).length;
  const pool = previous.filter((s) => (warm ? !isWorkingSet(s) : isWorkingSet(s)));
  if (pool.length === 0) return null;
  const match = pool[ordinal] ?? (warm ? null : pool[pool.length - 1]);
  return match ? setHintFrom(match, type, unit) : null;
}
