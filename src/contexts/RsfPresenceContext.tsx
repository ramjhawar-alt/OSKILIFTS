import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from './AuthContext';
import { nextPresence, type Presence } from '../domain/rsfGeofence';
import {
  getCurrentFix,
  getLocationPermission,
  requestLocationPermission,
} from '../services/locationService';
import {
  clearAtRsf,
  getFriendsAtRsf,
  getSharingEnabled,
  setAtRsf,
  setSharingEnabled,
  type FriendAtRsf,
} from '../services/rsfPresenceService';

/** off: not sharing. at / away: sharing, and where the last reading put me. */
export type PresenceStatus = 'off' | 'starting' | 'at' | 'away' | 'denied' | 'unavailable';

interface RsfPresenceValue {
  sharing: boolean;
  status: PresenceStatus;
  friendsAtRsf: FriendAtRsf[];
  /** Asks for location permission and starts sharing. Resolves to the resulting status. */
  enable: () => Promise<PresenceStatus>;
  disable: () => Promise<void>;
  refreshFriends: () => Promise<void>;
}

const RsfPresenceContext = createContext<RsfPresenceValue | undefined>(undefined);

const CHECK_EVERY_MS = 60_000;

/**
 * Runs only while the app is open. Reads my location on this device, decides
 * "at the RSF or not", and tells the server just that. Coordinates are never
 * sent, stored, or logged.
 */
export const RsfPresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<PresenceStatus>('off');
  const [friendsAtRsf, setFriendsAtRsf] = useState<FriendAtRsf[]>([]);

  const sharingRef = useRef(false);
  const presenceRef = useRef<Presence>('unknown');
  const checkingRef = useRef(false);

  const refreshFriends = useCallback(async () => {
    setFriendsAtRsf(await getFriendsAtRsf());
  }, []);

  const check = useCallback(async () => {
    if (!sharingRef.current || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const fix = await getCurrentFix();
      const previous = presenceRef.current;
      const next = nextPresence(previous, fix);
      presenceRef.current = next;
      if (!sharingRef.current) return; // turned off while we were reading
      if (next === 'in') {
        await setAtRsf(); // every check while there, which keeps the 25-minute expiry fresh
        setStatus('at');
      } else {
        if (previous === 'in') await clearAtRsf();
        setStatus('away');
      }
    } catch {
      // No reading this time (timeout, brief signal loss): keep the last state;
      // the server expires a stale "at the RSF" by itself.
    } finally {
      checkingRef.current = false;
      if (!sharingRef.current) clearAtRsf().catch(() => undefined);
    }
  }, []);

  // Restore my choice for this account.
  useEffect(() => {
    let active = true;
    sharingRef.current = false;
    presenceRef.current = 'unknown';
    setSharing(false);
    setStatus('off');
    if (!userId) return undefined;
    (async () => {
      if (!(await getSharingEnabled(userId))) return;
      const permission = await getLocationPermission();
      if (!active) return;
      if (permission !== 'granted') {
        setStatus(permission === 'unavailable' ? 'unavailable' : 'denied');
        return;
      }
      sharingRef.current = true;
      setSharing(true);
      setStatus('starting');
      check();
    })();
    return () => {
      active = false;
    };
  }, [userId, check]);

  // Re-check every minute and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!userId) return undefined;
    const interval = setInterval(() => {
      check();
      refreshFriends();
    }, CHECK_EVERY_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check();
        refreshFriends();
      }
    });
    refreshFriends();
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [userId, check, refreshFriends]);

  const enable = useCallback(async (): Promise<PresenceStatus> => {
    if (!userId) return 'off';
    let permission = await getLocationPermission();
    if (permission !== 'granted') permission = await requestLocationPermission();
    if (permission !== 'granted') {
      const failed: PresenceStatus = permission === 'unavailable' ? 'unavailable' : 'denied';
      setStatus(failed);
      return failed;
    }
    await setSharingEnabled(userId, true);
    sharingRef.current = true;
    presenceRef.current = 'unknown';
    setSharing(true);
    setStatus('starting');
    check();
    return 'starting';
  }, [userId, check]);

  const disable = useCallback(async () => {
    sharingRef.current = false;
    presenceRef.current = 'unknown';
    setSharing(false);
    setStatus('off');
    if (userId) await setSharingEnabled(userId, false);
    await clearAtRsf().catch(() => undefined);
  }, [userId]);

  const value = useMemo<RsfPresenceValue>(
    () => ({ sharing, status, friendsAtRsf, enable, disable, refreshFriends }),
    [sharing, status, friendsAtRsf, enable, disable, refreshFriends],
  );

  return <RsfPresenceContext.Provider value={value}>{children}</RsfPresenceContext.Provider>;
};

export function useRsfPresence(): RsfPresenceValue {
  const context = useContext(RsfPresenceContext);
  if (!context) throw new Error('useRsfPresence must be used within an RsfPresenceProvider');
  return context;
}
