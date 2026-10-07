import { friendlyHeadingError, DEFAULT_HEADING_MINUTES } from '../domain/rsfHeading';
import { supabase } from './supabaseClient';

export interface FriendHeading {
  id: string;
  username: string;
  displayName: string | null;
  startedAt: string;
  expiresAt: string;
}

/** Starts (or restarts) "heading to the RSF". Resolves to when it expires. */
export async function setHeading(minutes: number = DEFAULT_HEADING_MINUTES): Promise<string> {
  const { data, error } = await supabase.rpc('set_heading', { p_minutes: minutes });
  if (error) throw new Error(friendlyHeadingError(error.message));
  return String(data);
}

export async function clearHeading(): Promise<void> {
  const { error } = await supabase.rpc('clear_heading');
  if (error) throw new Error(friendlyHeadingError(error.message));
}

/** My own active status, or null. Never throws, so the Home screen survives a missing migration. */
export async function getMyHeading(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_my_heading');
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

/** Friends heading to the RSF right now. Never throws. */
export async function getFriendsHeading(): Promise<FriendHeading[]> {
  try {
    const { data, error } = await supabase.rpc('get_friends_heading');
    if (error) return [];
    return (data ?? []).map(
      (row: { id: string; username: string; display_name: string | null; started_at: string; expires_at: string }) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        startedAt: row.started_at,
        expiresAt: row.expires_at,
      }),
    );
  } catch {
    return [];
  }
}
