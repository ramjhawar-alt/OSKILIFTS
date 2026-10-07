import { supabase } from './supabaseClient';
import { normalizeEntries } from '../domain/entry';
import { TERMS_VERSION } from '../config/legal';
import { friendlyCommentError } from '../domain/comments';
import type { WeightUnit } from '../domain/units';
import type {
  BlockedUser,
  ConnectionKind,
  ConnectionUser,
  FeedItem,
  FollowRequest,
  Profile,
  ProfileSummary,
  Relationship,
  SearchResult,
  WorkoutComment,
} from '../types/social';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  terms_accepted_at: string | null;
  // Absent until migration 006 has been run.
  weight_unit?: string | null;
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    termsAcceptedAt: row.terms_accepted_at,
    weightUnit: row.weight_unit === 'kg' ? 'kg' : 'lb',
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Sets the username/display name and accepts the current terms in one write. */
export async function claimProfile(
  username: string,
  displayName: string,
): Promise<Profile> {
  const userId = await requireUserId();
  const cleanUsername = username.trim().toLowerCase();
  const cleanDisplayName = displayName.trim();

  if (!USERNAME_PATTERN.test(cleanUsername)) {
    throw new Error(
      'Usernames are 3-20 characters: lowercase letters, numbers and underscores.',
    );
  }
  if (cleanDisplayName.length < 1 || cleanDisplayName.length > 40) {
    throw new Error('Display name must be 1-40 characters.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: cleanUsername,
      display_name: cleanDisplayName,
      terms_version: TERMS_VERSION,
    })
    .eq('id', userId)
    .is('username', null)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(friendlyProfileError(error));
  if (!data) {
    // Already claimed (e.g. on another device); just accept the terms.
    return acceptTerms(userId);
  }
  return rowToProfile(data as ProfileRow);
}

/** For accounts that already have a username but haven't accepted these terms. */
export async function acceptTerms(userId?: string): Promise<Profile> {
  const id = userId ?? (await requireUserId());
  const { data, error } = await supabase
    .from('profiles')
    .update({ terms_version: TERMS_VERSION })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(friendlyProfileError(error));
  return rowToProfile(data as ProfileRow);
}

/** Persists the viewer's unit. Fails with a clear message if migration 006 isn't applied. */
export async function setWeightUnit(unit: WeightUnit): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('profiles')
    .update({ weight_unit: unit })
    .eq('id', userId);
  if (error) throw new Error(friendlyProfileError(error));
}

function friendlyProfileError(error: { code?: string; message: string }): string {
  if (error.code === UNIQUE_VIOLATION) return 'That username is taken.';
  if (error.message.includes('username_not_allowed')) {
    return "That username isn't available.";
  }
  if (error.message.includes('display_name_not_allowed')) {
    return "That display name isn't allowed.";
  }
  if (error.message.includes('username_immutable')) {
    return 'Usernames can’t be changed once set.';
  }
  if (error.code === CHECK_VIOLATION) {
    return 'Usernames are 3-20 characters: lowercase letters, numbers and underscores.';
  }
  return error.message;
}

// ---------------------------------------------------------------------------
// search / profiles
// ---------------------------------------------------------------------------
export async function searchProfiles(prefix: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('search_profiles', {
    p_prefix: prefix.trim().toLowerCase(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row: { id: string; username: string; display_name: string | null; relationship: Relationship }) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      relationship: row.relationship,
    }),
  );
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary | null> {
  const { data, error } = await supabase.rpc('get_profile_summary', { p_user: userId });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    relationship: row.relationship,
    workoutCount: row.workout_count === null ? null : Number(row.workout_count),
    workoutDates: row.workout_dates ?? null,
  };
}

export const CONNECTIONS_PAGE_SIZE = 50;

/**
 * One page of someone's followers or following. The server only answers for
 * yourself or someone you follow (everyone else gets an empty list), and hides
 * anyone blocked in either direction.
 */
export async function getConnections(
  userId: string,
  kind: ConnectionKind,
  cursor?: { createdAt: string; id: string },
): Promise<ConnectionUser[]> {
  const { data, error } = await supabase.rpc('get_connections', {
    p_user: userId,
    p_kind: kind,
    p_limit: CONNECTIONS_PAGE_SIZE,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row: {
      id: string;
      username: string;
      display_name: string | null;
      relationship: Relationship;
      created_at: string;
    }) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      relationship: row.relationship,
      createdAt: row.created_at,
    }),
  );
}

// ---------------------------------------------------------------------------
// follows
// ---------------------------------------------------------------------------
function friendlyFollowError(error: { code?: string; message: string }): string {
  if (error.message.includes('follow_blocked')) return 'You can’t follow this user.';
  if (error.message.includes('too_many_pending_requests')) {
    return 'You have too many pending follow requests. Wait for some to be answered.';
  }
  if (error.message.includes('follow_rate_limited')) {
    return 'You’re sending requests too quickly. Try again in a bit.';
  }
  return error.message;
}

export async function followUser(userId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: me, followee_id: userId });
  // Already requested/following: nothing to do.
  if (error && error.code !== UNIQUE_VIOLATION) {
    throw new Error(friendlyFollowError(error));
  }
}

/** Unfollow, or cancel a pending request. */
export async function unfollowUser(userId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', me)
    .eq('followee_id', userId);
  if (error) throw new Error(error.message);
}

export async function acceptFollowRequest(followerId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('followee_id', me);
  if (error) throw new Error(error.message);
}

/** Decline a request, or remove an existing follower. */
export async function removeFollower(followerId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', me);
  if (error) throw new Error(error.message);
}

export async function getIncomingRequests(): Promise<FollowRequest[]> {
  const me = await requireUserId();
  const { data, error } = await supabase
    .from('follows')
    .select(
      'follower_id, created_at, follower:profiles!follows_follower_id_fkey(username, display_name)',
    )
    .eq('followee_id', me)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    followerId: row.follower_id,
    username: row.follower?.username ?? null,
    displayName: row.follower?.display_name ?? null,
    createdAt: row.created_at,
  }));
}

export async function getIncomingRequestCount(): Promise<number> {
  const me = await requireUserId();
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('followee_id', me)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// feed
// ---------------------------------------------------------------------------
export const FEED_PAGE_SIZE = 20;

export async function getFeed(
  cursor?: { createdAt: string; id: string },
): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('get_feed', {
    p_limit: FEED_PAGE_SIZE,
    p_before_created_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    date: new Date(row.date).toISOString(),
    dayType: row.day_type,
    // Other people's jsonb: never trusted, always normalized.
    exercises: normalizeEntries(row.exercises),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    likeCount: Number(row.like_count),
    likedByMe: Boolean(row.liked_by_me),
    commentCount: 0,
  }));
}

// ---------------------------------------------------------------------------
// likes
// ---------------------------------------------------------------------------
export async function likeWorkout(workoutId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('workout_likes')
    .insert({ workout_id: workoutId, user_id: me });
  // Double-tap: already liked is success.
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

export async function unlikeWorkout(workoutId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('workout_likes')
    .delete()
    .eq('workout_id', workoutId)
    .eq('user_id', me);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------
export const COMMENTS_PAGE_SIZE = 30;

interface CommentRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  body: string;
  created_at: string;
  can_delete: boolean;
}

function rowToComment(row: CommentRow): WorkoutComment {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    body: row.body,
    createdAt: row.created_at,
    canDelete: Boolean(row.can_delete),
  };
}

/** Oldest first. Pass the last comment's createdAt/id to get the next page. */
export async function getComments(
  workoutId: string,
  cursor?: { createdAt: string; id: string },
): Promise<WorkoutComment[]> {
  const { data, error } = await supabase.rpc('get_comments', {
    p_workout: workoutId,
    p_limit: COMMENTS_PAGE_SIZE,
    p_after_created_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
  });
  if (error) throw new Error(friendlyCommentError(error.message));
  return (data ?? []).map(rowToComment);
}

export async function addComment(workoutId: string, body: string): Promise<WorkoutComment> {
  const { data, error } = await supabase.rpc('add_comment', { p_workout: workoutId, p_body: body });
  if (error) throw new Error(friendlyCommentError(error.message));
  const row = (data ?? [])[0];
  if (!row) throw new Error('Your comment couldn’t be posted.');
  return rowToComment(row);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_comment', { p_comment: commentId });
  if (error) throw new Error(friendlyCommentError(error.message));
}

/**
 * Comment counts for a page of workouts, keyed by workout id. Never throws: a
 * missing count must not take the feed down (e.g. before migration 009 is run).
 */
export async function getCommentCounts(workoutIds: string[]): Promise<Record<string, number>> {
  if (workoutIds.length === 0) return {};
  try {
    const { data, error } = await supabase.rpc('get_comment_counts', {
      p_workout_ids: workoutIds.slice(0, 50),
    });
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.workout_id] = Number(row.comment_count);
    return counts;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// blocks
// ---------------------------------------------------------------------------
export async function blockUser(userId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: me, blocked_id: userId });
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

export async function unblockUser(userId: string): Promise<void> {
  const me = await requireUserId();
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', userId);
  if (error) throw new Error(error.message);
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const me = await requireUserId();
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(username, display_name)')
    .eq('blocker_id', me)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    userId: row.blocked_id,
    username: row.blocked?.username ?? null,
    displayName: row.blocked?.display_name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------
export type ReportReason =
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'spam'
  | 'impersonation'
  | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual or graphic content' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Something else' },
];

export async function submitReport(
  targetType: 'workout' | 'profile' | 'comment',
  targetId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details?.trim() ? details.trim().slice(0, 1000) : null,
  });
  if (!error) return;
  if (error.message.includes('report_rate_limited')) {
    throw new Error('You’ve sent too many reports today. Please try again tomorrow.');
  }
  if (error.message.includes('report_target_not_found')) {
    throw new Error('That content is no longer available.');
  }
  if (error.message.includes('cannot_report_self')) {
    throw new Error('You can’t report yourself.');
  }
  throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// account deletion
// ---------------------------------------------------------------------------
/** Deletes the account and all its data server-side. The caller then signs out. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}
