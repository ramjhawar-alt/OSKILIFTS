import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';

import {
  inviteMessage,
  inviteUrl,
  parseInviteUrl,
  validatePendingInvite,
  type PendingInvite,
} from '../domain/invite';
import { supabase } from './supabaseClient';

const PENDING_KEY = '@oskilifts:pendingInvite';
const sharedKey = (userId: string) => `@oskilifts:inviteShared:${userId}`;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Called whenever a new pending invite is stored (e.g. a link opened while signed in). */
export function onPendingInvite(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadPendingInvite(): Promise<PendingInvite | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const valid = validatePendingInvite(JSON.parse(raw));
    if (!valid) await AsyncStorage.removeItem(PENDING_KEY);
    return valid;
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // nothing to clean up
  }
}

/** Remembers an invite link until the person has signed in, so it survives sign-up and email confirmation. */
export async function capturePendingInvite(url: string | null | undefined): Promise<boolean> {
  const username = parseInviteUrl(url);
  if (!username) return false;
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ username, savedAt: Date.now() }));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

export interface InviteTarget {
  id: string;
  username: string;
  displayName: string | null;
  isPublic: boolean;
}

/** Who is behind a /u/<username> link. Null if nobody, or if blocked. */
export async function resolveUsername(username: string): Promise<InviteTarget | null> {
  try {
    const { data, error } = await supabase.rpc('resolve_username', { p_username: username });
    if (error) return null;
    const row = (data ?? [])[0];
    if (!row) return null;
    return { id: row.id, username: row.username, displayName: row.display_name, isPublic: row.is_public === true };
  } catch {
    return null;
  }
}

/** "I joined through this link." Best effort: a failure must never get in the way. */
export async function recordInvite(username: string): Promise<void> {
  try {
    await supabase.rpc('record_invite', { p_inviter_username: username });
  } catch {
    // ignore
  }
}

export type InviteShareResult = 'shared' | 'copied' | 'cancelled';

/** Opens the share sheet where there is one, otherwise copies the link. */
export async function shareInvite(username: string): Promise<InviteShareResult> {
  const url = inviteUrl(username);
  const message = inviteMessage(username);
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: 'OSKILIFTS', text: 'Lift with me on OSKILIFTS, the gym app for Berkeley.', url });
        return 'shared';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
        // fall through to copying
      }
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      await nav.clipboard.writeText(url);
      return 'copied';
    }
    throw new Error(`Copy this link: ${url}`);
  }
  const result = await Share.share({ message });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}

export async function markInviteShared(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(sharedKey(userId), '1');
  } catch {
    // ignore
  }
}

export async function hasSharedInvite(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(sharedKey(userId))) === '1';
  } catch {
    return false;
  }
}
