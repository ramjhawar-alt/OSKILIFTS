import { friendlyGoalError, isValidGoal } from '../domain/weeklyGoal';
import { supabase } from './supabaseClient';

/** My weekly goal in days (1-7), or null. Never throws, so Home survives a missing migration. */
export async function getWeeklyGoal(): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('get_weekly_goal');
    if (error) return null;
    return isValidGoal(data) ? data : null;
  } catch {
    return null;
  }
}

/** Sets the goal; null clears it. */
export async function setWeeklyGoal(days: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_weekly_goal', { p_days: days });
  if (error) throw new Error(friendlyGoalError(error.message));
}
