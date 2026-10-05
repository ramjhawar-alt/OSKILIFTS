import { supabase } from './supabaseClient';
import { TERMS_VERSION } from '../config/legal';
import type { Profile } from '../types/social';

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
