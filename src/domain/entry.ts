import type {
  EntryData,
  Exercise,
  ExerciseType,
  PrKind,
  SetData,
  SetKind,
  StoredEntry,
  StoredEntryV1,
  StoredEntryV2,
  StoredSet,
} from '../types/workout';
import { defaultTypeForName, isExerciseType } from './exerciseTypes';
import { MAX_KG, roundKg } from './units';

// ---------------------------------------------------------------------------
// Limits. The normalizer is a security boundary: get_feed returns other users'
// jsonb verbatim, so everything read from storage goes through here and can
// never throw or grow without bound.
// ---------------------------------------------------------------------------
export const MAX_ENTRIES = 60;
export const MAX_SETS = 60;
export const MAX_NAME_LENGTH = 80;
const MAX_REPS = 999;
const MAX_SECONDS = 86_400;
const MAX_METERS = 1_000_000;
const MAX_PRS = 3;

const PR_KINDS: PrKind[] = ['weight', 'e1rm', 'reps'];
const SET_KINDS: SetKind[] = ['warmup', 'drop', 'failure'];

// Old key -> current key, applied by exerciseKey(). Empty today: exercises have
// never been renamed. Add an entry when renaming a default so history survives.
const RENAMED: Record<string, string> = {};

/** Identity of an exercise for history/PR lookups. Name-based on purpose. */
export function exerciseKey(name: string): string {
  const key = String(name)
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  return RENAMED[key] ?? key;
}

// ---------------------------------------------------------------------------
// coercion helpers
// ---------------------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = toNumber(value);
  if (n === null) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

function clampKg(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null || n <= 0 || n > MAX_KG) return null;
  return roundKg(n);
}

function clampMeters(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null || n <= 0 || n > MAX_METERS) return null;
  return Math.round(n * 100) / 100;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/[​-‍﻿]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

function cleanExercise(raw: unknown): Exercise | null {
  if (!isRecord(raw)) return null;
  const name = cleanName(raw.name);
  if (!name) return null;
  const exercise: Exercise = { name, isCustom: raw.isCustom === true };
  if (typeof raw.muscleGroup === 'string' && raw.muscleGroup.length > 0) {
    exercise.muscleGroup = raw.muscleGroup.slice(0, 40);
  }
  if (isExerciseType(raw.type)) exercise.type = raw.type;
  return exercise;
}

function emptySet(overrides: Partial<SetData> = {}): SetData {
  return { kg: null, reps: null, kind: 'normal', rpe: null, sec: null, m: null, ...overrides };
}

function resolveType(exercise: Exercise, sets: SetData[]): ExerciseType {
  if (exercise.type) return exercise.type;
  const byName = defaultTypeForName(exercise.name);
  if (byName) return byName;
  if (sets.some((s) => s.m !== null)) return 'distance_duration';
  if (sets.some((s) => s.sec !== null)) return 'duration';
  return 'weight_reps';
}

function makeEntry(
  exercise: Exercise,
  sets: SetData[],
  prs: PrKind[],
  legacy: StoredEntryV1 | null,
): EntryData {
  return {
    exercise: { ...exercise, type: resolveType(exercise, sets) },
    key: exerciseKey(exercise.name),
    sets,
    prs,
    legacy,
    touched: false,
  };
}

// ---------------------------------------------------------------------------
// legacy ({exercise, sets, reps}) entries
// ---------------------------------------------------------------------------
function legacyFromRaw(raw: Record<string, unknown>, exercise: Exercise): StoredEntryV1 {
  const setCount = clampInt(raw.sets, 1, MAX_SETS) ?? 1;
  const reps = raw.reps;
  let cleanReps: number | number[];
  if (Array.isArray(reps)) {
    cleanReps = reps.slice(0, MAX_SETS).map((r) => clampInt(r, 0, MAX_REPS) as number);
  } else {
    cleanReps = clampInt(reps, 0, MAX_REPS) as number;
  }
  return { exercise, sets: setCount, reps: cleanReps };
}

function legacySets(legacy: StoredEntryV1): SetData[] {
  const { sets, reps } = legacy;
  const count = Array.isArray(reps) ? Math.max(1, Math.min(MAX_SETS, reps.length)) : sets;
  const result: SetData[] = [];
  for (let i = 0; i < count; i += 1) {
    const value = Array.isArray(reps) ? reps[i] : reps;
    // 0/NaN reps from old free-text input mean "unknown", not "zero reps".
    result.push(emptySet({ reps: typeof value === 'number' && value >= 1 ? value : null }));
  }
  return result;
}

/** Wraps a freshly picked {exercise, sets, reps} so the writer emits the original shape. */
export function entryFromLegacy(exercise: Exercise, sets: number, reps: number | number[]): EntryData {
  const cleanEx = cleanExercise(exercise) ?? { name: 'Exercise', isCustom: false };
  const legacy = legacyFromRaw({ sets, reps }, cleanEx);
  return makeEntry(cleanEx, legacySets(legacy), [], legacy);
}

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------
function normalizeSet(raw: unknown): SetData {
  if (!isRecord(raw)) return emptySet();
  const kind = SET_KINDS.includes(raw.kind as SetKind) ? (raw.kind as SetKind) : 'normal';
  return {
    kg: clampKg(raw.kg),
    reps: clampInt(raw.reps, 1, MAX_REPS),
    kind,
    rpe: (() => {
      const n = toNumber(raw.rpe);
      return n !== null && n >= 1 && n <= 10 ? n : null;
    })(),
    sec: clampInt(raw.sec, 1, MAX_SECONDS),
    m: clampMeters(raw.m),
  };
}

function normalizePrs(raw: unknown): PrKind[] {
  if (!Array.isArray(raw)) return [];
  const result: PrKind[] = [];
  for (const item of raw) {
    if (PR_KINDS.includes(item as PrKind) && !result.includes(item as PrKind)) {
      result.push(item as PrKind);
    }
    if (result.length >= MAX_PRS) break;
  }
  return result;
}

/**
 * Turns whatever is in a workout's `exercises` jsonb into EntryData[]. Never
 * throws; malformed entries are dropped and numbers are clamped.
 */
export function normalizeEntries(raw: unknown): EntryData[] {
  if (!Array.isArray(raw)) return [];
  const entries: EntryData[] = [];
  for (const item of raw.slice(0, MAX_ENTRIES)) {
    try {
      if (!isRecord(item)) continue;
      const exercise = cleanExercise(item.exercise);
      if (!exercise) continue;

      if (Array.isArray(item.log)) {
        const sets = item.log.slice(0, MAX_SETS).map(normalizeSet);
        entries.push(makeEntry(exercise, sets, normalizePrs(item.prs), null));
      } else {
        const legacy = legacyFromRaw(item, exercise);
        entries.push(makeEntry(exercise, legacySets(legacy), [], legacy));
      }
    } catch {
      // Defensive: a hostile value must never take down a screen.
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// writing
// ---------------------------------------------------------------------------
export function isWorkingSet(set: SetData): boolean {
  return set.kind !== 'warmup';
}

function storeSet(set: SetData): StoredSet {
  const stored: StoredSet = {};
  if (set.kg !== null) stored.kg = roundKg(set.kg);
  if (set.reps !== null) stored.reps = set.reps;
  if (set.kind !== 'normal') stored.kind = set.kind;
  if (set.rpe !== null) stored.rpe = set.rpe;
  if (set.sec !== null) stored.sec = set.sec;
  if (set.m !== null) stored.m = set.m;
  return stored;
}

/** {sets, reps} as an old client would have written it (non-warmup sets only). */
export function legacyProjection(entry: EntryData): { sets: number; reps: number | number[] } {
  if (entry.legacy && !entry.touched) {
    return { sets: entry.legacy.sets, reps: entry.legacy.reps };
  }
  const working = entry.sets.filter(isWorkingSet);
  const type = entry.exercise.type;
  if (type === 'duration' || type === 'distance_duration') {
    return { sets: working.length, reps: 1 };
  }
  const reps = working.map((s) => s.reps ?? 0);
  if (reps.length === 0) return { sets: 0, reps: 0 };
  const allEqual = reps.every((r) => r === reps[0]);
  return { sets: working.length, reps: allEqual ? reps[0] : reps };
}

export function entryToStored(entry: EntryData): StoredEntry {
  if (entry.legacy && !entry.touched) return entry.legacy;
  const { exercise } = entry;
  const stored: StoredEntryV2 = {
    v: 2,
    exercise: {
      name: exercise.name,
      isCustom: exercise.isCustom,
      ...(exercise.muscleGroup ? { muscleGroup: exercise.muscleGroup } : {}),
      type: exercise.type,
    },
    log: entry.sets.slice(0, MAX_SETS).map(storeSet),
    ...(entry.prs.length > 0 ? { prs: entry.prs.slice(0, MAX_PRS) } : {}),
    ...legacyProjection(entry),
  };
  return stored;
}

/** The only writer: untouched legacy entries come back byte-identical. */
export function entriesToStored(entries: EntryData[]): StoredEntry[] {
  return entries.slice(0, MAX_ENTRIES).map(entryToStored);
}
