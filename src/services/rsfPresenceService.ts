import AsyncStorage from '@react-native-async-storage/async-storage';

import { friendlyHeadingError } from '../domain/rsfHeading';
import { mapFriendRow, type FriendAtRsf, type FriendAtRsfRow } from '../domain/rsfFriends';
import { supabase } from './supabaseClient';

export type { FriendAtRsf };

/** Tells the server I'm at the RSF (just that: no coordinates exist in the request). */
export async function setAtRsf(): Promise<void> {
  const { error } = await supabase.rpc('set_at_rsf');
  if (error) throw new Error(friendlyHeadingError(error.message));
}

export async function clearAtRsf(): Promise<void> {
  const { error } = await supabase.rpc('clear_at_rsf');
  if (error) throw new Error(friendlyHeadingError(error.message));
}

/**
 * Friends at the RSF now, each with their bear stage. Asks for the version with stages first
 * (migration 020) and falls back to the original list (everyone shows as Baby Oski) if that
 * isn't installed yet. Never throws, so Home survives a missing migration.
 */
export async function getFriendsAtRsf(): Promise<FriendAtRsf[]> {
  try {
    const withStages = await supabase.rpc('get_friends_at_rsf_stages');
    if (!withStages.error) return ((withStages.data ?? []) as FriendAtRsfRow[]).map(mapFriendRow);
    const { data, error } = await supabase.rpc('get_friends_at_rsf');
    if (error) return [];
    return ((data ?? []) as FriendAtRsfRow[]).map(mapFriendRow);
  } catch {
    return [];
  }
}

// The opt-in lives on this device, because this device is the one reading its location.
const key = (userId: string) => `@oskilifts:shareRsfPresence:${userId}`;

export async function getSharingEnabled(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === '1';
  } catch {
    return false;
  }
}

export async function setSharingEnabled(userId: string, enabled: boolean): Promise<void> {
  try {
    if (enabled) await AsyncStorage.setItem(key(userId), '1');
    else await AsyncStorage.removeItem(key(userId));
  } catch {
    // The in-memory state still applies for this session.
  }
}
