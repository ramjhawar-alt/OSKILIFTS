import { useEffect, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { calculateWorkoutStreak, getBearStage } from '../services/bearStreakService';
import { getHistory } from '../services/historyCache';

/** My own bear stage (1-10) from my workout streak, or null until it has loaded. */
export function useMyBearStage(): number | null {
  const { user } = useAuth();
  const [stage, setStage] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setStage(null);
      return undefined;
    }
    let active = true;
    getHistory(user.id)
      .then((history) => {
        if (active) setStage(getBearStage(calculateWorkoutStreak(history.workouts)));
      })
      .catch(() => undefined); // the bear is a nicety; the logging screen works without it
    return () => {
      active = false;
    };
  }, [user?.id]);

  return stage;
}
