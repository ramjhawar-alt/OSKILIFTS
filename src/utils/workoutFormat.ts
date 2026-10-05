import type { ExerciseEntry } from '../types/workout';

// Builds a local Date from the YYYY-MM-DD part of an ISO string so the shown
// day never shifts with the viewer's timezone (workouts are stored at noon UTC).
export function getDateFromISOString(isoString: string): Date {
  const datePart = isoString.split('T')[0];
  return getDateFromDateString(datePart);
}

export function getDateFromDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatReps(reps: ExerciseEntry['reps']): string {
  return Array.isArray(reps) ? reps.join(', ') : String(reps);
}

// e.g. "3 sets × 8, 8, 6 reps"
export function formatExerciseEntry(entry: ExerciseEntry): string {
  return `${entry.sets} sets × ${formatReps(entry.reps)} reps`;
}
