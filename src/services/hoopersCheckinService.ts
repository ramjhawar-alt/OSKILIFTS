import { friendlyHoopersError } from '../domain/hoopers';
import { supabase } from './supabaseClient';

export interface Hooper {
  id: string;
  username: string;
  displayName: string | null;
  checkedInAt: string;
  expiresAt: string;
  isFriend: boolean;
}

export interface CourtSnapshot {
  count: number;
  hoopers: Hooper[];
  /** When my own check-in ends, or null if I'm not checked in. */
  myCheckInEndsAt: string | null;
}

/** Checks me in for 60 minutes (again to extend). Resolves to when it ends. */
export async function checkIn(): Promise<string> {
  const { data, error } = await supabase.rpc('hoopers_check_in');
  if (error) throw new Error(friendlyHoopersError(error.message));
  return String(data);
}

export async function checkOut(): Promise<void> {
  const { error } = await supabase.rpc('hoopers_check_out');
  if (error) throw new Error(friendlyHoopersError(error.message));
}

/** Who is playing, how many, and whether I'm checked in. Throws if the court can't be read. */
export async function getCourt(friendsOnly: boolean): Promise<CourtSnapshot> {
  const [count, list, mine] = await Promise.all([
    supabase.rpc('get_hoopers_count'),
    supabase.rpc('get_hoopers', { p_friends_only: friendsOnly }),
    supabase.rpc('get_my_hoopers_checkin'),
  ]);
  const failure = count.error ?? list.error ?? mine.error;
  if (failure) throw new Error(friendlyHoopersError(failure.message));
  return {
    count: Number(count.data ?? 0),
    hoopers: (list.data ?? []).map(
      (row: {
        id: string;
        username: string;
        display_name: string | null;
        checked_in_at: string;
        expires_at: string;
        is_friend: boolean;
      }) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        checkedInAt: row.checked_in_at,
        expiresAt: row.expires_at,
        isFriend: row.is_friend === true,
      }),
    ),
    myCheckInEndsAt: mine.data ? String(mine.data) : null,
  };
}
