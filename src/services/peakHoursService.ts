import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface HourBucket {
  hour: number;
  avgPercent: number | null;
  sampleCount?: number;
}

export interface PeakSlot {
  hour: number;
  avgPercent: number;
  label: string;
}

export type PeakVerdict =
  | 'closed'
  | 'wait'
  | 'go_now'
  | 'best_now'
  | 'collecting';

export interface PeakRecommendation {
  verdict: PeakVerdict;
  headline: string;
  detail: string;
  suggestedHour: number | null;
}

export interface PeakHoursData {
  hasEnoughData: boolean;
  /** True once each weekday (Sun–Sat) has at least one snapshot; drives full chart UI */
  peakHoursReady?: boolean;
  /** How many distinct weekdays (0–6) appear in the dataset */
  daysCovered?: number;
  missingWeekdays?: string[];
  /** Mirrors hasEnoughData for older responses */
  hasData?: boolean;
  message?: string;
  totalSamples?: number;
  today?: number;
  currentHour?: number;
  currentPercent?: number | null;
  byDay?: Record<string, HourBucket[]>;
  busiest?: PeakSlot | null;
  bestTime?: PeakSlot | null;
  busiestDay?: string | null;
  dataRange?: {
    oldest?: string;
    newest?: string;
  };
  recommendation?: PeakRecommendation;
  busiestText?: string;
  bestTimeText?: string;
}

const normalizeBaseUrl = (value?: string | null) => {
  if (!value) {
    return undefined;
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const envBaseUrl = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_OSKILIFTS_API_URL ?? null,
);

const getNetworkIP = (): string | null => {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest?.hostUri ||
      Constants.expoConfig?.extra?.hostUri;

    if (hostUri) {
      const match = hostUri.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        const ip = match[1];
        if (
          ip !== '127.0.0.1' &&
          ip !== '0.0.0.0' &&
          !ip.startsWith('169.254.')
        ) {
          return ip;
        }
      }
    }

    const debuggerHost =
      Constants.expoConfig?.debuggerHost || Constants.manifest?.debuggerHost;
    if (debuggerHost) {
      const match = debuggerHost.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        const ip = match[1];
        if (
          ip !== '127.0.0.1' &&
          ip !== '0.0.0.0' &&
          !ip.startsWith('169.254.')
        ) {
          return ip;
        }
      }
    }
  } catch (error) {
    console.warn('[PeakHours API] Error detecting network IP:', error);
  }
  return null;
};

const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    const isProduction =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      !window.location.hostname.includes('192.168.') &&
      !window.location.hostname.includes('172.16.');

    if (isProduction) {
      return envBaseUrl || 'https://oskilifts.onrender.com';
    }

    return 'http://localhost:4000';
  }

  const networkIP = getNetworkIP();
  const hostUri =
    Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || '';
  const debuggerHost =
    Constants.expoConfig?.debuggerHost || Constants.manifest?.debuggerHost || '';

  if (envBaseUrl) {
    return envBaseUrl;
  }

  const isSimulator =
    (hostUri &&
      (hostUri.includes('127.0.0.1') || hostUri.includes('localhost'))) ||
    (debuggerHost &&
      (debuggerHost.includes('127.0.0.1') ||
        debuggerHost.includes('localhost'))) ||
    (!hostUri && !debuggerHost && !networkIP) ||
    Constants.executionEnvironment === 'storeClient';

  if (isSimulator) {
    return 'http://127.0.0.1:4000';
  }

  if (networkIP) {
    return `http://${networkIP}:4000`;
  }

  console.warn(
    '[PeakHours API] Could not determine network IP, falling back to localhost. Set EXPO_PUBLIC_OSKILIFTS_API_URL env var if this fails.',
  );
  return 'http://127.0.0.1:4000';
};

const API_BASE_URL = getBaseUrl();

/**
 * Peak hours analytics (historical occupancy patterns).
 */
export async function getPeakHours(): Promise<PeakHoursData> {
  const url = `${API_BASE_URL}/api/peak-hours`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch peak hours: ${response.status}`);
    }

    const data = (await response.json()) as PeakHoursData;
    return data;
  } catch (error) {
    console.error('[PeakHours] Error fetching peak hours:', error);
    return {
      hasEnoughData: false,
      hasData: false,
      peakHoursReady: false,
      message:
        'Unable to load peak hours. Check your connection or try again shortly.',
      recommendation: {
        verdict: 'collecting',
        headline: 'Offline',
        detail:
          'We could not reach the analytics service. Pull to refresh when you are back online.',
        suggestedHour: null,
      },
    };
  }
}
