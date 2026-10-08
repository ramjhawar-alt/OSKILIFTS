import { supabase } from './supabaseClient';

export interface EmailPrefs {
  weeklyDigest: boolean;
  /** They have answered the question at least once, so we stop asking. */
  decided: boolean;
}

/** My email settings. Never throws, so the app survives a missing migration (returns null). */
export async function getEmailPrefs(): Promise<EmailPrefs | null> {
  try {
    const { data, error } = await supabase.rpc('get_email_prefs');
    if (error) return null;
    const row = (data ?? [])[0];
    if (!row) return null;
    return { weeklyDigest: row.weekly_digest === true, decided: row.decided === true };
  } catch {
    return null;
  }
}

export async function setWeeklyDigest(on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_weekly_digest', { p_on: on });
  if (error) throw new Error(error.message);
}
