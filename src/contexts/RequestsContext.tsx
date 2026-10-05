import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getIncomingRequestCount } from '../services/socialService';

interface RequestsContextValue {
  pendingCount: number;
  refreshPending: () => Promise<void>;
}

const RequestsContext = createContext<RequestsContextValue | undefined>(undefined);

// Without push notifications, the Feed tab badge is the only way someone
// learns they have follow requests, so refresh on mount and on app foreground.
export const RequestsProvider = ({ children }: { children: ReactNode }) => {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount(await getIncomingRequestCount());
    } catch (error) {
      console.error('[Requests] Failed to load pending count:', error);
    }
  }, []);

  useEffect(() => {
    refreshPending();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPending();
    });
    return () => subscription.remove();
  }, [refreshPending]);

  const value = useMemo(() => ({ pendingCount, refreshPending }), [pendingCount, refreshPending]);
  return <RequestsContext.Provider value={value}>{children}</RequestsContext.Provider>;
};

export function useRequests(): RequestsContextValue {
  const context = useContext(RequestsContext);
  if (!context) throw new Error('useRequests must be used within a RequestsProvider');
  return context;
}
