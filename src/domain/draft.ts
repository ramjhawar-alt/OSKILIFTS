import type {
  EntryData,
  Exercise,
  ExerciseType,
  SetData,
  SetKind,
  StoredEntryV1,
  WorkoutDayType,
  WorkoutVisibility,
  Workout,
} from '../types/workout';
import { entryFromSets, normalizeEntries } from './entry';
import { defaultTypeForName } from './exerciseTypes';
import {
  distanceInputText,
  formatDuration,
  parseDistanceInput,
  parseDurationInput,
  parseWeightInput,
  roundKg,
  weightInputText,
  type WeightUnit,
} from './units';

export const MAX_DRAFT_ENTRIES = 40;
export const MAX_DRAFT_SETS = 30;
const DRAFT_VERSION = 1;

export type RowKind = 'normal' | SetKind;

export interface DraftSet {
  id: string;
  kind: RowKind;
  weightText: string;
  repsText: string;
  secText: string;
  distText: string;
  done: boolean;
}

export interface DraftEntry {
  id: string;
  exercise: Exercise & { type: ExerciseType };
  sets: DraftSet[];
  // Set when the entry came from a legacy {sets, reps} workout. While `touched`
  // is false the original is written back unchanged.
  legacy: StoredEntryV1 | null;
  touched: boolean;
}

export interface DraftWorkout {
  v: number;
  unit: WeightUnit;
  date: string; // YYYY-MM-DD
  dayType: WorkoutDayType | null;
  notes: string;
  visibility: WorkoutVisibility;
  entries: DraftEntry[];
  startedAt: number;
  editingId?: string;
  routineId?: string;
}

// ---------------------------------------------------------------------------
// ids (stable React keys; never array indexes)
// ---------------------------------------------------------------------------
let counter = 0;
export function uid(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// construction
// ---------------------------------------------------------------------------
export function createDraft(options: {
  date: string;
  unit: WeightUnit;
  now?: number;
  visibility?: WorkoutVisibility;
}): DraftWorkout {
  return {
    v: DRAFT_VERSION,
    unit: options.unit,
    date: options.date,
    dayType: null,
    notes: '',
    visibility: options.visibility ?? 'followers',
    entries: [],
    startedAt: options.now ?? Date.now(),
  };
}

export function emptySet(kind: RowKind = 'normal'): DraftSet {
  return { id: uid(), kind, weightText: '', repsText: '', secText: '', distText: '', done: false };
}

export function typeFor(exercise: Exercise): ExerciseType {
  return exercise.type ?? defaultTypeForName(exercise.name) ?? 'weight_reps';
}

export function defaultSetCount(type: ExerciseType): number {
  return type === 'duration' || type === 'distance_duration' ? 1 : 3;
}

export function newEntry(exercise: Exercise, setCount?: number): DraftEntry {
  const type = typeFor(exercise);
  const count = Math.min(MAX_DRAFT_SETS, setCount ?? defaultSetCount(type));
  return {
    id: uid(),
    exercise: { ...exercise, type },
    sets: Array.from({ length: count }, () => emptySet()),
    legacy: null,
    touched: true,
  };
}

function rowFromSet(set: SetData, unit: WeightUnit): DraftSet {
  return {
    id: uid(),
    kind: set.kind,
    weightText: weightInputText(set.kg, unit),
    repsText: set.reps === null ? '' : String(set.reps),
    secText: set.sec === null ? '' : formatDuration(set.sec),
    distText: distanceInputText(set.m, unit),
    done: true, // everything stored was completed
  };
}

/** Turns a saved workout into an editable draft. Old-shape entries become reps-only rows. */
export function draftFromWorkout(workout: Workout, unit: WeightUnit): DraftWorkout {
  return {
    v: DRAFT_VERSION,
    unit,
    date: workout.date.split('T')[0],
    dayType: workout.dayType,
    notes: workout.notes ?? '',
    visibility: workout.visibility ?? 'followers',
    startedAt: Date.now(),
    editingId: workout.id,
    entries: workout.exercises.slice(0, MAX_DRAFT_ENTRIES).map((entry) => ({
      id: uid(),
      exercise: entry.exercise,
      sets: entry.sets.slice(0, MAX_DRAFT_SETS).map((set) => rowFromSet(set, unit)),
      legacy: entry.legacy,
      touched: false,
    })),
  };
}

// ---------------------------------------------------------------------------
// parsing one row
// ---------------------------------------------------------------------------
function parseReps(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= 999 ? n : null;
}

/** The row as SetData, or null if it can't be logged as it stands. */
export function parseSet(type: ExerciseType, row: DraftSet, unit: WeightUnit): SetData | null {
  const base = { kind: row.kind, rpe: null as number | null };
  const weightEmpty = row.weightText.trim() === '';
  const weight = weightEmpty ? null : parseWeightInput(row.weightText, unit);
  if (!weightEmpty && weight === null) return null;

  switch (type) {
    case 'duration': {
      const sec = parseDurationInput(row.secText);
      return sec === null ? null : { ...base, kg: null, reps: null, sec, m: null };
    }
    case 'distance_duration': {
      const distEmpty = row.distText.trim() === '';
      const timeEmpty = row.secText.trim() === '';
      if (distEmpty && timeEmpty) return null;
      const m = distEmpty ? null : parseDistanceInput(row.distText, unit);
      const sec = timeEmpty ? null : parseDurationInput(row.secText);
      if ((!distEmpty && m === null) || (!timeEmpty && sec === null)) return null;
      return { ...base, kg: null, reps: null, sec, m };
    }
    default: {
      const reps = parseReps(row.repsText);
      if (reps === null) return null;
      return { ...base, kg: weight === null ? null : roundKg(weight), reps, sec: null, m: null };
    }
  }
}

export function isRowComplete(type: ExerciseType, row: DraftSet, unit: WeightUnit): boolean {
  return parseSet(type, row, unit) !== null;
}

function rowHasData(row: DraftSet): boolean {
  return [row.weightText, row.repsText, row.secText, row.distText].some((t) => t.trim() !== '');
}

// ---------------------------------------------------------------------------
// draft -> entries to save
// ---------------------------------------------------------------------------
export interface DraftConversion {
  entries: EntryData[];
  errors: string[];
  /** Unchecked rows that had something typed in them; they are not saved. */
  discardedUnchecked: number;
}

export function draftToEntries(draft: DraftWorkout): DraftConversion {
  const errors: string[] = [];
  const entries: EntryData[] = [];
  let discardedUnchecked = 0;

  for (const entry of draft.entries) {
    if (entry.legacy && !entry.touched) {
      const [original] = normalizeEntries([entry.legacy]);
      if (original) entries.push(original);
      continue;
    }
    const type = entry.exercise.type;
    const sets: SetData[] = [];
    entry.sets.forEach((row, index) => {
      if (!row.done) {
        if (rowHasData(row)) discardedUnchecked += 1;
        return;
      }
      const parsed = parseSet(type, row, draft.unit);
      if (!parsed) {
        errors.push(`${entry.exercise.name}: set ${index + 1} is incomplete or invalid.`);
        return;
      }
      sets.push(parsed);
    });
    if (sets.length > 0) entries.push(entryFromSets(entry.exercise, sets));
  }

  if (errors.length === 0 && entries.length === 0) {
    errors.push('Complete at least one set to save your workout.');
  }
  if (draft.entries.length > MAX_DRAFT_ENTRIES) errors.push(`A workout can have at most ${MAX_DRAFT_ENTRIES} exercises.`);
  return { entries, errors, discardedUnchecked };
}

export function countUncheckedWithData(draft: DraftWorkout): number {
  let count = 0;
  for (const entry of draft.entries) {
    if (entry.legacy && !entry.touched) continue;
    for (const row of entry.sets) if (!row.done && rowHasData(row)) count += 1;
  }
  return count;
}

export function draftHasContent(draft: DraftWorkout): boolean {
  return (
    draft.entries.length > 0 ||
    draft.notes.trim() !== '' ||
    draft.dayType !== null
  );
}

// ---------------------------------------------------------------------------
// unit switch while a draft is open
// ---------------------------------------------------------------------------
export function convertDraftUnit(draft: DraftWorkout, unit: WeightUnit): DraftWorkout {
  if (draft.unit === unit) return draft;
  const convert = (row: DraftSet): DraftSet => {
    const kg = row.weightText.trim() === '' ? null : parseWeightInput(row.weightText, draft.unit);
    const m = row.distText.trim() === '' ? null : parseDistanceInput(row.distText, draft.unit);
    return {
      ...row,
      weightText: kg === null ? row.weightText : weightInputText(kg, unit),
      distText: m === null ? row.distText : distanceInputText(m, unit),
    };
  };
  return {
    ...draft,
    unit,
    entries: draft.entries.map((entry) => ({ ...entry, sets: entry.sets.map(convert) })),
  };
}

// ---------------------------------------------------------------------------
// reducer
// ---------------------------------------------------------------------------
export type DraftAction =
  | { type: 'replaceDraft'; draft: DraftWorkout }
  | { type: 'addEntries'; exercises: Exercise[] }
  | { type: 'removeEntry'; entryId: string }
  | { type: 'replaceExercise'; entryId: string; exercise: Exercise }
  | { type: 'addSet'; entryId: string }
  | { type: 'removeLastSet'; entryId: string }
  | {
      type: 'patchSet';
      entryId: string;
      setId: string;
      patch: Partial<Pick<DraftSet, 'weightText' | 'repsText' | 'secText' | 'distText'>>;
    }
  | { type: 'toggleDone'; entryId: string; setId: string }
  | { type: 'cycleKind'; entryId: string; setId: string }
  | { type: 'checkAllValid' }
  | {
      type: 'setMeta';
      patch: Partial<Pick<DraftWorkout, 'date' | 'dayType' | 'notes' | 'visibility'>>;
    };

const KIND_CYCLE: RowKind[] = ['normal', 'warmup', 'drop', 'failure'];

function updateEntry(
  draft: DraftWorkout,
  entryId: string,
  fn: (entry: DraftEntry) => DraftEntry,
): DraftWorkout {
  let changed = false;
  const entries = draft.entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    const next = fn(entry);
    if (next !== entry) changed = true;
    return next;
  });
  return changed ? { ...draft, entries } : draft;
}

const touch = (entry: DraftEntry, patch: Partial<DraftEntry>): DraftEntry => ({
  ...entry,
  ...patch,
  touched: true,
});

export function draftReducer(draft: DraftWorkout, action: DraftAction): DraftWorkout {
  switch (action.type) {
    case 'replaceDraft':
      return action.draft;

    case 'addEntries': {
      const room = Math.max(0, MAX_DRAFT_ENTRIES - draft.entries.length);
      const added = action.exercises.slice(0, room).map((exercise) => newEntry(exercise));
      return added.length === 0 ? draft : { ...draft, entries: [...draft.entries, ...added] };
    }

    case 'removeEntry':
      return { ...draft, entries: draft.entries.filter((entry) => entry.id !== action.entryId) };

    case 'replaceExercise':
      return updateEntry(draft, action.entryId, (entry) => {
        const type = typeFor(action.exercise);
        return touch(entry, {
          exercise: { ...action.exercise, type },
          // A different exercise type means different columns; start clean.
          sets: type === entry.exercise.type ? entry.sets : newEntry(action.exercise).sets,
        });
      });

    case 'addSet':
      return updateEntry(draft, action.entryId, (entry) => {
        if (entry.sets.length >= MAX_DRAFT_SETS) return entry;
        const last = entry.sets[entry.sets.length - 1];
        const copy: DraftSet = last
          ? { ...last, id: uid(), done: false, kind: last.kind === 'warmup' ? 'normal' : last.kind }
          : emptySet();
        return touch(entry, { sets: [...entry.sets, copy] });
      });

    case 'removeLastSet':
      return updateEntry(draft, action.entryId, (entry) =>
        entry.sets.length <= 1 ? entry : touch(entry, { sets: entry.sets.slice(0, -1) }),
      );

    case 'patchSet':
      return updateEntry(draft, action.entryId, (entry) =>
        touch(entry, {
          sets: entry.sets.map((row) =>
            row.id === action.setId
              // Editing a completed set un-completes it so numbers can't change silently.
              ? { ...row, ...action.patch, done: false }
              : row,
          ),
        }),
      );

    case 'toggleDone':
      return updateEntry(draft, action.entryId, (entry) => {
        const row = entry.sets.find((s) => s.id === action.setId);
        if (!row) return entry;
        const nextDone = !row.done;
        if (nextDone && !isRowComplete(entry.exercise.type, row, draft.unit)) return entry;
        return touch(entry, {
          sets: entry.sets.map((s) => (s.id === action.setId ? { ...s, done: nextDone } : s)),
        });
      });

    case 'cycleKind':
      return updateEntry(draft, action.entryId, (entry) =>
        touch(entry, {
          sets: entry.sets.map((row) =>
            row.id === action.setId
              ? { ...row, kind: KIND_CYCLE[(KIND_CYCLE.indexOf(row.kind) + 1) % KIND_CYCLE.length] }
              : row,
          ),
        }),
      );

    case 'checkAllValid':
      return {
        ...draft,
        entries: draft.entries.map((entry) => {
          if (entry.legacy && !entry.touched) return entry;
          let changed = false;
          const sets = entry.sets.map((row) => {
            if (row.done || !rowHasData(row) || !isRowComplete(entry.exercise.type, row, draft.unit)) return row;
            changed = true;
            return { ...row, done: true };
          });
          return changed ? touch(entry, { sets }) : entry;
        }),
      };

    case 'setMeta':
      return { ...draft, ...action.patch };

    default:
      return draft;
  }
}

// ---------------------------------------------------------------------------
// persistence (the storage itself lives in a service; this is just the format)
// ---------------------------------------------------------------------------
export function serializeDraft(draft: DraftWorkout): string {
  return JSON.stringify(draft);
}

/** Returns null for anything that isn't a well-formed current-version draft. */
export function parseStoredDraft(raw: string | null): DraftWorkout | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as DraftWorkout;
    if (
      !value ||
      value.v !== DRAFT_VERSION ||
      !Array.isArray(value.entries) ||
      value.entries.length > MAX_DRAFT_ENTRIES ||
      typeof value.date !== 'string' ||
      (value.unit !== 'lb' && value.unit !== 'kg')
    ) {
      return null;
    }
    for (const entry of value.entries) {
      if (!entry || !entry.exercise || typeof entry.exercise.name !== 'string' || !Array.isArray(entry.sets)) return null;
      if (entry.sets.length > MAX_DRAFT_SETS) return null;
    }
    return value;
  } catch {
    return null;
  }
}
