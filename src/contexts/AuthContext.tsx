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
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { migrateLocalWorkoutsToCloud } from '../services/workoutStorage';

const BERKELEY_EMAIL = /^[^\s@]+@berkeley\.edu$/i;
const MIN_PASSWORD_LENGTH = 8;
const PRODUCTION_ORIGIN = 'https://oskilifts.com';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  /** Resolves true if the user must confirm their email before signing in. */
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertBerkeleyEmail(email: string) {
  if (!BERKELEY_EMAIL.test(email)) {
    throw new Error('Only @berkeley.edu email addresses can use OSKILIFTS.');
  }
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Accounts are not configured for this build.');
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const migratedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch((error) => {
        console.error('[Auth] Failed to restore session:', error);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId || migratedFor.current === userId) return;
    migratedFor.current = userId;
    migrateLocalWorkoutsToCloud().catch((error) => {
      console.error('[Auth] Local workout migration failed:', error);
      migratedFor.current = null;
    });
  }, [userId]);

  const signUp = useCallback(async (email: string, password: string) => {
    assertConfigured();
    const normalized = normalizeEmail(email);
    assertBerkeleyEmail(normalized);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
    });
    if (error) throw new Error(error.message);

    // Supabase returns no session until the confirmation link is clicked.
    return data.session === null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    assertConfigured();
    const normalized = normalizeEmail(email);
    assertBerkeleyEmail(normalized);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    // Best effort: stop showing "at the RSF" while we can still authenticate.
    try {
      await supabase.rpc('clear_at_rsf');
    } catch {
      // The server also expires it on its own within 25 minutes.
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    assertConfigured();
    const normalized = normalizeEmail(email);
    assertBerkeleyEmail(normalized);

    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : PRODUCTION_ORIGIN;

    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${origin}/reset-password.html`,
    });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
    }),
    [session, initializing, signUp, signIn, signOut, requestPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
