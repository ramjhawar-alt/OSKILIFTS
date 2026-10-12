import { useCallback, useEffect, useState } from 'react';

import { fetchWeightRoomStatus } from '../services/api';
import { getPeakHours, type PeakHoursData } from '../services/peakHoursService';
import type { WeightRoomStatus } from '../types/api';

/** Live RSF weight-room crowd (and, if asked, the usual-busyness chart), with a refresh. */
export function useRsfData({ withPeakHours = false }: { withPeakHours?: boolean } = {}) {
  const [status, setStatus] = useState<WeightRoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHoursData | null>(null);
  const [peakHoursLoading, setPeakHoursLoading] = useState(withPeakHours);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchWeightRoomStatus(false));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load capacity data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeakHours = useCallback(async () => {
    if (!withPeakHours) return;
    setPeakHoursLoading(true);
    try {
      setPeakHours(await getPeakHours());
    } catch {
      setPeakHours({
        hasEnoughData: false,
        hasData: false,
        perDaySummary: {},
        insights: [],
        message: 'Unable to load peak hours data.',
      });
    } finally {
      setPeakHoursLoading(false);
    }
  }, [withPeakHours]);

  // Paint whatever was cached instantly, then fetch fresh.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { getCached, CACHE_KEYS } = await import('../services/cache');
        const cached = await getCached(CACHE_KEYS.WEIGHT_ROOM);
        if (active && cached) {
          setStatus(cached as WeightRoomStatus);
          setLoading(false);
        }
      } catch {
        // cache is optional
      }
    })();
    loadStatus();
    loadPeakHours();
    return () => {
      active = false;
    };
  }, [loadStatus, loadPeakHours]);

  const refresh = useCallback(async () => {
    await Promise.all([loadStatus(), loadPeakHours()]);
  }, [loadStatus, loadPeakHours]);

  return { status, loading, error, peakHours, peakHoursLoading, refresh };
}

/** green / amber / red for the crowd, from the server's own status wording. */
export function crowdTone(status: WeightRoomStatus | null): 'go' | 'wait' | 'closed' {
  if (!status) return 'go';
  if (!status.isOpen) return 'closed';
  return status.status?.toLowerCase().includes('wait') ? 'wait' : 'go';
}
