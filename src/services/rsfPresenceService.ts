import AsyncStorage from '@react-native-async-storage/async-storage';

import { friendlyHeadingError } from '../domain/rsfHeading';
import { supabase } from './supabaseClient';

export interface FriendAtRsf {
  id: string;
  username: string;
  displayName: string | null;
  arrivedAt: string;
  expiresAt: string;
}

/** Tells the server I'm at the RSF (just that: no coordinates exist in the request). */
export async function setAtRsf(): Promise<void> {
  const { error } = await supabase.rpc('set_at_rsf');
  if (error) throw new Error(friendlyHeadingError(error.message));
}

export async function clearAtRsf(): Promise<void> {
  const { error } = await supabase.rpc('clear_at_rsf');
  if (error) throw new Error(friendlyHeadingError(error.message));
}

/** Friends at the RSF now. Never throws, so Home survives a missing migration. */
export async function getFriendsAtRsf(): Promise<FriendAtRsf[]> {
  try {
    const { data, error } = await supabase.rpc('get_friends_at_rsf');
    if (error) return [];
    return (data ?? []).map(
      (row: { id: string; username: string; display_name: string | null; arrived_at: string; expires_at: string }) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        arrivedAt: row.arrived_at,
        expiresAt: row.expires_at,
      }),
    );
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
