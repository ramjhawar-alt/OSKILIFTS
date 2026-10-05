import { supabase } from './supabaseClient';
import { TERMS_VERSION } from '../config/legal';
import type {
  FeedItem,
  FollowRequest,
  Profile,
  ProfileSummary,
  Relationship,
  SearchResult,
} from '../types/social';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  terms_accepted_at: string | null;
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    termsAcceptedAt: row.terms_accepted_at,
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
    .select('id, username, display_name, terms_accepted_at')
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
    .select('id, username, display_name, terms_accepted_at')
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
    .select('id, username, display_name, terms_accepted_at')
    .single();
  if (error) throw new Error(friendlyProfileError(error));
  return rowToProfile(data as ProfileRow);
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
    exercises: row.exercises,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    likeCount: Number(row.like_count),
    likedByMe: Boolean(row.liked_by_me),
  }));
}
