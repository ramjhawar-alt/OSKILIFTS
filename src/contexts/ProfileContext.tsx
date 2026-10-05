import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthContext';
import { getMyProfile } from '../services/socialService';
import type { Profile } from '../types/social';

interface ProfileContextValue {
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const loaded = await getMyProfile(userId);
      setProfile(loaded);
      if (!loaded) setProfileError('We couldn’t find your profile.');
    } catch (error) {
      console.error('[Profile] Failed to load profile:', error);
      setProfile(null);
      setProfileError(
        error instanceof Error ? error.message : 'Unable to load your profile.',
      );
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      // True from the moment a user is known until their profile resolves, so
      // the navigator never flashes the main app before the gate is decided.
      profileLoading: profileLoading || (Boolean(userId) && !profile && !profileError),
      profileError,
      refreshProfile: load,
      setProfile,
    }),
    [profile, profileLoading, profileError, userId, load],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
