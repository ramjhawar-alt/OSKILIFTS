import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Workout,
  WorkoutDayType,
  WorkoutVisibility,
  Exercise,
  ExerciseEntry,
} from '../types/workout';
import {
  DEFAULT_WORKOUT_DAY_TYPES,
  DEFAULT_EXERCISES,
} from '../data/workoutDefaults';
import { supabase } from './supabaseClient';

// Legacy on-device keys. Only read now, by migrateLocalWorkoutsToCloud().
const LEGACY_WORKOUTS_KEY = '@oskilifts:workouts';
const LEGACY_CUSTOM_DAY_TYPES_KEY = '@oskilifts:customDayTypes';
const LEGACY_CUSTOM_EXERCISES_KEY = '@oskilifts:customExercises';
const MIGRATED_FLAG_PREFIX = '@oskilifts:workoutsMigratedToCloud:';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';
const PAGE_SIZE = 1000; // PostgREST caps responses at 1000 rows

const WORKOUT_COLUMNS = 'id, date, day_type, exercises, notes, visibility';

interface WorkoutRow {
  id: string;
  date: string;
  day_type: WorkoutDayType;
  exercises: ExerciseEntry[];
  notes: string | null;
  visibility: WorkoutVisibility;
}

interface WorkoutInsert {
  user_id: string;
  date: string;
  day_type: WorkoutDayType;
  exercises: ExerciseEntry[];
  notes: string | null;
  // Omitted -> the column default ('followers') applies.
  visibility?: WorkoutVisibility;
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in to access workouts.');
  return userId;
}

function rowToWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    // timestamptz comes back as "+00:00"; screens split on "T" and expect
    // the "...T12:00:00.000Z" shape LogWorkoutScreen writes.
    date: new Date(row.date).toISOString(),
    dayType: row.day_type,
    exercises: row.exercises,
    notes: row.notes ?? undefined,
    visibility: row.visibility,
  };
}

function workoutToInsert(workout: Workout, userId: string): WorkoutInsert {
  return {
    user_id: userId,
    date: workout.date,
    day_type: workout.dayType,
    exercises: workout.exercises,
    notes: workout.notes ?? null,
    ...(workout.visibility ? { visibility: workout.visibility } : {}),
  };
}

// Workout operations
export async function saveWorkout(workout: Workout): Promise<void> {
  try {
    const userId = await requireUserId();
    const row = workoutToInsert(workout, userId);

    // Legacy "workout-<timestamp>" ids (new workouts, or unmigrated local ones)
    // aren't uuids: insert and let Postgres assign the id.
    if (isUuid(workout.id)) {
      const { data, error } = await supabase
        .from('workouts')
        .update({
          date: row.date,
          day_type: row.day_type,
          exercises: row.exercises,
          notes: row.notes,
          // Only when the caller set it, so an edit can never silently reshare
          // a private workout.
          ...(row.visibility ? { visibility: row.visibility } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', workout.id)
        .eq('user_id', userId)
        .select('id');
      if (error) throw error;
      if (data && data.length > 0) return;
      // The row no longer exists (e.g. deleted on another device): re-create.
    }

    const { error } = await supabase.from('workouts').insert(row);
    if (error) throw error;
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
}

export async function getWorkouts(): Promise<Workout[]> {
  try {
    const userId = await requireUserId();
    const workouts: Workout[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('workouts')
        .select(WORKOUT_COLUMNS)
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as WorkoutRow[];
      workouts.push(...page.map(rowToWorkout));
      if (page.length < PAGE_SIZE) break;
    }
    return workouts;
  } catch (error) {
    console.error('Error getting workouts:', error);
    return [];
  }
}

export async function getWorkoutsByDateRange(
  startDate: Date,
  endDate: Date,
): Promise<Workout[]> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('workouts')
      .select(WORKOUT_COLUMNS)
      .eq('user_id', userId)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as WorkoutRow[]).map(rowToWorkout);
  } catch (error) {
    console.error('Error getting workouts by date range:', error);
    return [];
  }
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  try {
    const userId = await requireUserId();
    if (!isUuid(workoutId)) return;
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting workout:', error);
    throw error;
  }
}

export async function getWorkoutById(workoutId: string): Promise<Workout | null> {
  try {
    const userId = await requireUserId();
    if (!isUuid(workoutId)) return null;
    const { data, error } = await supabase
      .from('workouts')
      .select(WORKOUT_COLUMNS)
      .eq('id', workoutId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToWorkout(data as WorkoutRow) : null;
  } catch (error) {
    console.error('Error getting workout by id:', error);
    return null;
  }
}

// Workout day type operations
export async function getWorkoutDayTypes(): Promise<WorkoutDayType[]> {
  try {
    const customTypes = await getCustomWorkoutDayTypes();
    return [...DEFAULT_WORKOUT_DAY_TYPES, ...customTypes];
  } catch (error) {
    console.error('Error getting workout day types:', error);
    return DEFAULT_WORKOUT_DAY_TYPES;
  }
}

export async function getCustomWorkoutDayTypes(): Promise<WorkoutDayType[]> {
  try {
    await requireUserId();
    const { data, error } = await supabase
      .from('custom_day_types')
      .select('name')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ name: row.name, isCustom: true }));
  } catch (error) {
    console.error('Error getting custom day types:', error);
    return [];
  }
}

export async function saveCustomWorkoutDayType(
  dayType: WorkoutDayType,
): Promise<void> {
  try {
    const userId = await requireUserId();
    const customTypes = await getCustomWorkoutDayTypes();
    const lowerName = dayType.name.toLowerCase();

    if (
      customTypes.some((t) => t.name.toLowerCase() === lowerName) ||
      DEFAULT_WORKOUT_DAY_TYPES.some((t) => t.name.toLowerCase() === lowerName)
    ) {
      throw new Error('Workout day type already exists');
    }

    const { error } = await supabase
      .from('custom_day_types')
      .insert({ user_id: userId, name: dayType.name });
    if (error) {
      // Lost a race with another device: the unique index is the real guard.
      if (error.code === UNIQUE_VIOLATION) {
        throw new Error('Workout day type already exists');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving custom day type:', error);
    throw error;
  }
}

// Exercise database operations
export async function getExerciseDatabase(): Promise<Exercise[]> {
  try {
    const customExercises = await getCustomExercises();
    return [...DEFAULT_EXERCISES, ...customExercises];
  } catch (error) {
    console.error('Error getting exercise database:', error);
    return DEFAULT_EXERCISES;
  }
}

export async function getCustomExercises(): Promise<Exercise[]> {
  try {
    await requireUserId();
    const { data, error } = await supabase
      .from('custom_exercises')
      .select('name, muscle_group')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      name: row.name,
      isCustom: true,
      muscleGroup: row.muscle_group ?? undefined,
    }));
  } catch (error) {
    console.error('Error getting custom exercises:', error);
    return [];
  }
}

export async function saveCustomExercise(exercise: Exercise): Promise<void> {
  try {
    const userId = await requireUserId();
    const customExercises = await getCustomExercises();
    const lowerName = exercise.name.toLowerCase();

    if (
      customExercises.some((e) => e.name.toLowerCase() === lowerName) ||
      DEFAULT_EXERCISES.some((e) => e.name.toLowerCase() === lowerName)
    ) {
      throw new Error('Exercise already exists');
    }

    const { error } = await supabase.from('custom_exercises').insert({
      user_id: userId,
      name: exercise.name,
      muscle_group: exercise.muscleGroup ?? null,
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new Error('Exercise already exists');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving custom exercise:', error);
    throw error;
  }
}

// One-time upload of pre-account, on-device data into the signed-in account.
async function readLegacyJson<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.error(`Error reading legacy data at ${key}:`, error);
    return [];
  }
}

export async function migrateLocalWorkoutsToCloud(): Promise<void> {
  const userId = await requireUserId();
  const flagKey = `${MIGRATED_FLAG_PREFIX}${userId}`;
  if (await AsyncStorage.getItem(flagKey)) return;

  const [localWorkouts, localDayTypes, localExercises] = await Promise.all([
    readLegacyJson<Workout>(LEGACY_WORKOUTS_KEY),
    readLegacyJson<WorkoutDayType>(LEGACY_CUSTOM_DAY_TYPES_KEY),
    readLegacyJson<Exercise>(LEGACY_CUSTOM_EXERCISES_KEY),
  ]);

  // Custom items first: they're filtered against what already exists, so a
  // retry after a partial failure can't duplicate them. The workouts batch is
  // last and all-or-nothing, so a retry can't duplicate those either.
  if (localDayTypes.length > 0) {
    const existing = new Set(
      (await getCustomWorkoutDayTypes()).map((t) => t.name.toLowerCase()),
    );
    const rows = dedupeByName(localDayTypes, existing).map((t) => ({
      user_id: userId,
      name: t.name,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from('custom_day_types').insert(rows);
      if (error) throw error;
    }
  }

  if (localExercises.length > 0) {
    const existing = new Set(
      (await getCustomExercises()).map((e) => e.name.toLowerCase()),
    );
    const rows = dedupeByName(localExercises, existing).map((e) => ({
      user_id: userId,
      name: e.name,
      muscle_group: e.muscleGroup ?? null,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from('custom_exercises').insert(rows);
      if (error) throw error;
    }
  }

  if (localWorkouts.length > 0) {
    // Pre-account workouts were never meant to be shared: keep them private.
    const rows = localWorkouts.map((workout) => ({
      ...workoutToInsert(workout, userId),
      visibility: 'private' as WorkoutVisibility,
    }));
    const { error } = await supabase.from('workouts').insert(rows);
    if (error) throw error;
  }

  // Clear local copies so a different account on this device can't inherit them.
  await AsyncStorage.multiRemove([
    LEGACY_WORKOUTS_KEY,
    LEGACY_CUSTOM_DAY_TYPES_KEY,
    LEGACY_CUSTOM_EXERCISES_KEY,
  ]);
  await AsyncStorage.setItem(flagKey, new Date().toISOString());
}

function dedupeByName<T extends { name: string }>(
  items: T[],
  alreadyTaken: Set<string>,
): T[] {
  const seen = new Set(alreadyTaken);
  return items.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
