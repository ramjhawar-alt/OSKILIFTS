import { supabase } from './supabaseClient';
import {
  cleanRoutineName,
  normalizeRoutineEntries,
  type Routine,
  type RoutineEntry,
} from '../domain/routines';
import type { WorkoutDayType } from '../types/workout';

const COLUMNS = 'id, name, day_type, exercises, notes, last_used_at, created_at';
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

export class RoutinesUnavailableError extends Error {
  constructor() {
    super('Routines aren’t available yet. Try again after the next update.');
    this.name = 'RoutinesUnavailableError';
  }
}

interface RoutineRow {
  id: string;
  name: string;
  day_type: WorkoutDayType | null;
  exercises: unknown;
  notes: string | null;
  last_used_at: string | null;
  created_at: string;
}

function rowToRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    dayType: row.day_type ?? null,
    entries: normalizeRoutineEntries(row.exercises),
    notes: row.notes ?? undefined,
    lastUsedAt: row.last_used_at ?? undefined,
    createdAt: row.created_at,
  };
}

function toError(error: { code?: string; message: string }): Error {
  // PostgREST reports a missing table as PGRST205; Postgres itself as 42P01.
  if (error.code === 'PGRST205' || error.code === '42P01') return new RoutinesUnavailableError();
  if (error.code === UNIQUE_VIOLATION) return new Error('You already have a routine with that name.');
  if (error.message.includes('too_many_routines')) return new Error('You can have up to 50 routines. Delete one first.');
  if (error.code === CHECK_VIOLATION) return new Error('That routine is too large or has an invalid name.');
  return new Error(error.message);
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

export async function listRoutines(): Promise<Routine[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('routines')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw toError(error);
  return ((data ?? []) as RoutineRow[]).map(rowToRoutine);
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('routines')
    .select(COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw toError(error);
  return data ? rowToRoutine(data as RoutineRow) : null;
}

export async function createRoutine(input: {
  name: string;
  dayType: WorkoutDayType | null;
  entries: RoutineEntry[];
}): Promise<Routine> {
  const userId = await requireUserId();
  const name = cleanRoutineName(input.name);
  if (!name) throw new Error('Give your routine a name.');
  if (input.entries.length === 0) throw new Error('Add at least one exercise first.');
  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: userId, name, day_type: input.dayType, exercises: input.entries })
    .select(COLUMNS)
    .single();
  if (error) throw toError(error);
  return rowToRoutine(data as RoutineRow);
}

export async function renameRoutine(id: string, name: string): Promise<void> {
  const userId = await requireUserId();
  const clean = cleanRoutineName(name);
  if (!clean) throw new Error('Give your routine a name.');
  const { error } = await supabase.from('routines').update({ name: clean }).eq('id', id).eq('user_id', userId);
  if (error) throw toError(error);
}

export async function deleteRoutine(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('routines').delete().eq('id', id).eq('user_id', userId);
  if (error) throw toError(error);
}

/** Best effort: failing to note "last used" must never block saving a workout. */
export async function markRoutineUsed(id: string): Promise<void> {
  try {
    const userId = await requireUserId();
    await supabase
      .from('routines')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
  } catch (error) {
    console.error('[Routines] could not mark routine used:', error);
  }
}
