import { weekStart } from './leaderboard';

export const MIN_GOAL_DAYS = 1;
export const MAX_GOAL_DAYS = 7;

export interface WeekProgress {
  goal: number;
  /** Different days trained so far this week (Monday to Sunday). */
  done: number;
  remaining: number;
  complete: boolean;
  /** Days left in the week including today. */
  daysLeft: number;
  /** Still possible to finish: enough days left for what remains. */
  reachable: boolean;
}

/** YYYY-MM-DD part of a stored workout date (stored at noon UTC on the day the person picked). */
function dayKey(storedDate: string): string | null {
  const key = storedDate.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function keyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Distinct trained days that fall in the 7-day week starting at `start`. */
function daysInWeek(keys: Set<string>, start: Date): number {
  let count = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    if (keys.has(keyOf(day))) count += 1;
  }
  return count;
}

function trainedDays(storedDates: string[]): Set<string> {
  const keys = new Set<string>();
  for (const stored of storedDates) {
    const key = dayKey(stored);
    if (key) keys.add(key);
  }
  return keys;
}

export function isValidGoal(days: unknown): days is number {
  return typeof days === 'number' && Number.isInteger(days) && days >= MIN_GOAL_DAYS && days <= MAX_GOAL_DAYS;
}

export function weekProgress(storedDates: string[], goal: number, now: Date): WeekProgress {
  const start = weekStart(now);
  const done = daysInWeek(trainedDays(storedDates), start);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = 7 - Math.round((today.getTime() - start.getTime()) / 86_400_000);
  const remaining = Math.max(0, goal - done);
  return {
    goal,
    done,
    remaining,
    complete: done >= goal,
    daysLeft,
    reachable: done >= goal || remaining <= daysLeft,
  };
}

/**
 * Weeks in a row that reached the goal. The current week counts once it is
 * complete; an unfinished current week doesn't break the streak, it just isn't
 * counted yet. Looks back at most a year.
 */
export function weekStreak(storedDates: string[], goal: number, now: Date): number {
  const keys = trainedDays(storedDates);
  const current = weekStart(now);
  let streak = daysInWeek(keys, current) >= goal ? 1 : 0;
  for (let weeksBack = 1; weeksBack <= 52; weeksBack += 1) {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * weeksBack);
    if (daysInWeek(keys, start) >= goal) streak += 1;
    else break;
  }
  return streak;
}

export function progressMessage(progress: WeekProgress): string {
  if (progress.complete) return 'Goal hit this week!';
  const to = progress.remaining === 1 ? '1 more day to go' : `${progress.remaining} more days to go`;
  if (!progress.reachable) return `${to}. Next week is a fresh start.`;
  return progress.daysLeft === 1 ? `${to}, and today is the last day.` : `${to}, ${progress.daysLeft} days left.`;
}

export function friendlyGoalError(message: string): string {
  if (message.includes('invalid_goal')) return 'Pick between 1 and 7 days.';
  if (message.includes('not_authenticated')) return 'Please sign in again.';
  return message;
}
