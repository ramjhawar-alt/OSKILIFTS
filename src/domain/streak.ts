import { isValidDateString, localDateString } from './dates';

/** Rest days in a row you can take without losing your streak. */
export const MAX_REST_DAYS = 2;

const DAY_MS = 86_400_000;

function dayNumber(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/**
 * The workout streak: how many training days in a row, where up to `maxRestDays`
 * rest days between two workouts don't break it. Rest days are not counted, only
 * days you trained. The streak is still alive while the last workout is within the
 * allowance of today, so it only ends once you've missed a full rest window.
 *
 * `dates` are workout dates (YYYY-MM-DD, or a stored timestamp starting with one).
 * Duplicates, junk values and future dates are ignored.
 */
export function workoutStreak(
  dates: string[],
  today: string = localDateString(),
  maxRestDays: number = MAX_REST_DAYS,
): number {
  const todayNumber = dayNumber(today);
  const days = new Set<number>();
  for (const raw of dates) {
    const key = typeof raw === 'string' ? raw.slice(0, 10) : '';
    if (!isValidDateString(key)) continue;
    const n = dayNumber(key);
    if (n <= todayNumber) days.add(n);
  }
  const sorted = [...days].sort((a, b) => b - a);
  if (sorted.length === 0) return 0;

  const maxGap = maxRestDays + 1;
  if (todayNumber - sorted[0] > maxGap) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] > maxGap) break;
    streak += 1;
  }
  return streak;
}
