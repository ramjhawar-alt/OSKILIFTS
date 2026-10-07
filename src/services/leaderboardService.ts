import { friendlyLeaderboardError, type BoardRow } from '../domain/leaderboard';
import { supabase } from './supabaseClient';

export async function joinLeaderboard(): Promise<void> {
  const { error } = await supabase.rpc('join_leaderboard');
  if (error) throw new Error(friendlyLeaderboardError(error.message));
}

export async function leaveLeaderboard(): Promise<void> {
  const { error } = await supabase.rpc('leave_leaderboard');
  if (error) throw new Error(friendlyLeaderboardError(error.message));
}

export interface LeaderboardState {
  joined: boolean;
  rows: BoardRow[];
}

/** Whether I'm on the board, and this week's rows. Never throws, so Home survives a missing migration. */
export async function getLeaderboard(): Promise<LeaderboardState | null> {
  try {
    const [member, board] = await Promise.all([
      supabase.rpc('am_i_on_leaderboard'),
      supabase.rpc('get_weekly_leaderboard'),
    ]);
    if (member.error || board.error) return null;
    return {
      joined: member.data === true,
      rows: (board.data ?? []).map(
        (row: { id: string; username: string; display_name: string | null; days: number; is_me: boolean }) => ({
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          days: Number(row.days),
          isMe: row.is_me === true,
        }),
      ),
    };
  } catch {
    return null;
  }
}
