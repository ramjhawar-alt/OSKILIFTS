export interface WorkoutDayType {
  name: string;
  isCustom: boolean;
}

export type ExerciseType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'duration'
  | 'distance_duration';

export interface Exercise {
  name: string;
  isCustom: boolean;
  muscleGroup?: string;
  // Snapshotted into each logged entry; feed viewers don't have the poster's
  // custom exercise catalog, so they can't look it up.
  type?: ExerciseType;
}

// ---------------------------------------------------------------------------
// Stored shapes (what lives in workouts.exercises jsonb)
// ---------------------------------------------------------------------------
export type SetKind = 'warmup' | 'drop' | 'failure'; // absent = normal
export type PrKind = 'weight' | 'e1rm' | 'reps';

// Sparse on purpose: get_feed ships this verbatim to every follower.
export interface StoredSet {
  kg?: number; // canonical unit; for bodyweight_reps this is ADDED weight
  reps?: number;
  kind?: SetKind;
  rpe?: number; // reserved
  sec?: number; // duration types, whole seconds
  m?: number; // distance in meters
}

/** The original shape. Still what existing workouts contain. */
export interface StoredEntryV1 {
  exercise: Exercise;
  sets: number;
  reps: number | number[];
}

export interface StoredEntryV2 {
  v: 2;
  exercise: Exercise;
  log: StoredSet[]; // completed sets only
  prs?: PrKind[]; // stamped when the workout was saved
  // Legacy projection (non-warmup sets) so older clients still render something sane.
  sets: number;
  reps: number | number[];
}

export type StoredEntry = StoredEntryV1 | StoredEntryV2;

// ---------------------------------------------------------------------------
// In-memory shapes (everything outside the storage layer)
// ---------------------------------------------------------------------------
export interface SetData {
  kg: number | null;
  reps: number | null;
  kind: 'normal' | SetKind;
  rpe: number | null;
  sec: number | null;
  m: number | null;
}

export interface EntryData {
  exercise: Exercise & { type: ExerciseType };
  key: string; // exerciseKey(exercise.name)
  sets: SetData[];
  prs: PrKind[];
  // Non-null iff this entry came from (or is still) the original shape.
  legacy: StoredEntryV1 | null;
  // Legacy entries that haven't been edited are written back byte-identical.
  touched: boolean;
}

export type WorkoutVisibility = 'followers' | 'private';

export interface Workout {
  id: string;
  date: string; // ISO date string
  createdAt?: string; // tie-breaker for two workouts on the same date
  dayType: WorkoutDayType;
  exercises: EntryData[];
  notes?: string;
  // Who besides you can see it. Absent on workouts not yet loaded from the
  // server; saveWorkout then leaves the stored value alone on edit.
  visibility?: WorkoutVisibility;
}

export type WorkoutHistory = Workout[];
