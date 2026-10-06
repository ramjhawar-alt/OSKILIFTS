import { buildHistoryIndex, type HistoryIndex } from '../domain/history';
import type { Workout } from '../types/workout';
import { currentHistoryVersion } from './historyVersion';
import { getWorkoutsStrict } from './workoutStorage';

const FRESH_MS = 30_000;

export interface History {
  workouts: Workout[];
  index: HistoryIndex;
}

interface Entry {
  userId: string;
  at: number;
  version: number;
  value: History;
}

let cached: Entry | null = null;
let inflight: { userId: string; version: number; promise: Promise<History> } | null = null;

/**
 * The user's full workout history plus a per-exercise index, fetched once and
 * shared by hints, PR detection and progress screens. Throws if the fetch
 * fails (an empty history must never be mistaken for "no workouts").
 */
export async function getHistory(userId: string, options: { force?: boolean } = {}): Promise<History> {
  const version = currentHistoryVersion();
  const now = Date.now();
  if (
    !options.force &&
    cached &&
    cached.userId === userId &&
    cached.version === version &&
    now - cached.at < FRESH_MS
  ) {
    return cached.value;
  }
  if (inflight && inflight.userId === userId && inflight.version === version && !options.force) {
    return inflight.promise;
  }

  const promise = (async () => {
    const workouts = await getWorkoutsStrict();
    const value = { workouts, index: buildHistoryIndex(workouts) };
    cached = { userId, at: Date.now(), version, value };
    return value;
  })();
  inflight = { userId, version, promise };
  try {
    return await promise;
  } finally {
    if (inflight?.promise === promise) inflight = null;
  }
}

export function clearHistoryCache(): void {
  cached = null;
  inflight = null;
}
