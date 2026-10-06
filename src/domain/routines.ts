import type { DraftEntry, DraftWorkout } from './draft';
import { createDraft, emptySet, newEntry, typeFor, uid, MAX_DRAFT_ENTRIES, MAX_DRAFT_SETS } from './draft';
import { exerciseKey } from './entry';
import type { WeightUnit } from './units';
import type { Exercise, SetKind, Workout, WorkoutDayType } from '../types/workout';

export const MAX_ROUTINE_ENTRIES = 40;
export const MAX_ROUTINE_NAME = 60;

export interface RoutineSet {
  kind?: SetKind;
  reps?: number;
}

export interface RoutineEntry {
  v: 1;
  exercise: Exercise;
  sets: RoutineSet[];
  restSec?: number;
}

export interface Routine {
  id: string;
  name: string;
  dayType: WorkoutDayType | null;
  entries: RoutineEntry[];
  notes?: string;
  lastUsedAt?: string;
  createdAt: string;
}

const SET_KINDS: SetKind[] = ['warmup', 'drop', 'failure'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Never throws; drops malformed entries and clamps sizes. */
export function normalizeRoutineEntries(raw: unknown): RoutineEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: RoutineEntry[] = [];
  for (const item of raw.slice(0, MAX_ROUTINE_ENTRIES)) {
    if (!record(item) || !record(item.exercise)) continue;
    const name = typeof item.exercise.name === 'string' ? item.exercise.name.trim().slice(0, 80) : '';
    if (!name) continue;
    const exercise: Exercise = { name, isCustom: item.exercise.isCustom === true };
    if (typeof item.exercise.muscleGroup === 'string') exercise.muscleGroup = item.exercise.muscleGroup.slice(0, 40);
    const type = item.exercise.type;
    if (type === 'weight_reps' || type === 'bodyweight_reps' || type === 'duration' || type === 'distance_duration') {
      exercise.type = type;
    }
    const sets: RoutineSet[] = (Array.isArray(item.sets) ? item.sets : [])
      .slice(0, MAX_DRAFT_SETS)
      .map((s) => {
        const set: RoutineSet = {};
        if (record(s)) {
          if (SET_KINDS.includes(s.kind as SetKind)) set.kind = s.kind as SetKind;
          const reps = Number(s.reps);
          if (Number.isInteger(reps) && reps >= 1 && reps <= 999) set.reps = reps;
        }
        return set;
      });
    const restSec = Number(item.restSec);
    entries.push({
      v: 1,
      exercise,
      sets: sets.length > 0 ? sets : [{}],
      ...(Number.isFinite(restSec) && restSec >= 5 && restSec <= 1800 ? { restSec: Math.round(restSec) } : {}),
    });
  }
  return entries;
}

/** Structure of a saved workout: weights are dropped, set types and reps kept. */
export function routineEntriesFromWorkout(workout: Workout): RoutineEntry[] {
  return workout.exercises.slice(0, MAX_ROUTINE_ENTRIES).map((entry) => ({
    v: 1,
    exercise: {
      name: entry.exercise.name,
      isCustom: entry.exercise.isCustom,
      ...(entry.exercise.muscleGroup ? { muscleGroup: entry.exercise.muscleGroup } : {}),
      type: entry.exercise.type,
    },
    sets: entry.sets.slice(0, MAX_DRAFT_SETS).map((set) => ({
      ...(set.kind !== 'normal' ? { kind: set.kind } : {}),
      ...(set.reps !== null ? { reps: set.reps } : {}),
    })),
  }));
}

/** Structure of an in-progress draft (typed reps count as the target; weights are ignored). */
export function routineEntriesFromDraft(draft: DraftWorkout): RoutineEntry[] {
  return draft.entries.slice(0, MAX_ROUTINE_ENTRIES).map((entry) => ({
    v: 1,
    exercise: {
      name: entry.exercise.name,
      isCustom: entry.exercise.isCustom,
      ...(entry.exercise.muscleGroup ? { muscleGroup: entry.exercise.muscleGroup } : {}),
      type: entry.exercise.type,
    },
    sets: entry.sets.map((row) => {
      const reps = Number(row.repsText);
      return {
        ...(row.kind !== 'normal' ? { kind: row.kind } : {}),
        ...(Number.isInteger(reps) && reps >= 1 && reps <= 999 ? { reps } : {}),
      };
    }),
  }));
}

/**
 * A new, unsaved draft pre-populated from a routine: rows unchecked and empty
 * (target reps filled in), with previous-session hints supplying the weights.
 */
export function draftFromRoutine(
  routine: Routine,
  options: { unit: WeightUnit; date: string; now?: number },
): DraftWorkout {
  const draft = createDraft({ date: options.date, unit: options.unit, now: options.now });
  const entries: DraftEntry[] = routine.entries.slice(0, MAX_DRAFT_ENTRIES).map((entry) => {
    const base = newEntry(entry.exercise, 1);
    return {
      ...base,
      id: uid(),
      exercise: { ...entry.exercise, type: typeFor(entry.exercise) },
      sets: entry.sets.map((set) => ({
        ...emptySet(set.kind ?? 'normal'),
        repsText: set.reps !== undefined ? String(set.reps) : '',
      })),
    };
  });
  return { ...draft, dayType: routine.dayType, entries, routineId: routine.id };
}

export function cleanRoutineName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_ROUTINE_NAME);
}

/** Exercise keys in a routine, for "does this routine use X" style lookups. */
export function routineKeys(routine: Routine): string[] {
  return routine.entries.map((e) => exerciseKey(e.exercise.name));
}
