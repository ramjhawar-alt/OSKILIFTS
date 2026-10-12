import { useCallback } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { draftHasContent } from '../domain/draft';
import { navigationRef } from '../navigation/navigationRef';
import { loadDraft } from '../services/draftStorage';

/**
 * What the big Log button does: open the logging screen, resuming a workout that was
 * left in progress (so tapping Log never silently starts over).
 */
export function useStartWorkout(): () => Promise<void> {
  const { user } = useAuth();
  const userId = user?.id;
  return useCallback(async () => {
    let resume = false;
    try {
      if (userId) {
        const draft = await loadDraft(userId);
        resume = Boolean(draft && draftHasContent(draft));
      }
    } catch {
      // no draft readable: start fresh
    }
    navigationRef.navigate('LogWorkout', resume ? { resume: true } : {});
  }, [userId]);
}
