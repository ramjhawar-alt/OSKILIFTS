import { useEffect, useRef } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { whenNavigationReady, navigationRef } from '../navigation/navigationRef';
import {
  clearPendingInvite,
  loadPendingInvite,
  onPendingInvite,
  recordInvite,
  resolveUsername,
} from '../services/inviteService';

/**
 * Once someone is signed in and set up, takes them to the profile of whoever invited
 * them (so the Follow button is one tap away), and records the invite for the metrics.
 * Renders nothing.
 */
export const InviteHandler = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const busy = useRef(false);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;

    const process = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const pending = await loadPendingInvite();
        if (!pending || !active) return;
        // One look only: whatever happens, don't act on the same link twice.
        await clearPendingInvite();
        const target = await resolveUsername(pending.username);
        if (!target || target.id === userId || !active) return;
        await recordInvite(pending.username);
        await whenNavigationReady(() => {
          navigationRef.navigate('FeedTab', { screen: 'UserProfile', params: { userId: target.id } });
        });
      } finally {
        busy.current = false;
      }
    };

    process();
    const unsubscribe = onPendingInvite(process);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  return null;
};
