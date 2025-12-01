import { Platform } from 'react-native';

export interface PeakHoursData {
  hasData: boolean;
  busiest?: string;
  bestTime?: string;
  message?: string;
  totalSamples?: number;
  busiestDay?: string;
  dataRange?: {
    oldest?: string;
    newest?: string;
  };
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

// For iOS simulator, always use 127.0.0.1 (more reliable than localhost)
// For other platforms, use env variable or default to 127.0.0.1
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    // For web: always use localhost in development (Expo web dev server)
    // Only use env var in production builds (deployed to Vercel)
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname !== 'localhost' && 
       window.location.hostname !== '127.0.0.1' &&
       !window.location.hostname.includes('192.168.') &&
       !window.location.hostname.includes('172.16.'));
    
    // In production (Vercel), use env var if set, otherwise fallback to localhost
    if (isProduction) {
      // Always use env var in production if it's set
      if (envBaseUrl) {
        return envBaseUrl;
      }
      // If no env var, try to use Render URL (fallback)
      return 'https://oskilifts.onrender.com';
    }
    
    // In development (Expo web), ALWAYS use localhost regardless of env var
    // The network IP is only for physical devices, not web browser
    return 'http://localhost:4000';
  }
  // iOS simulator needs 127.0.0.1 (more reliable than localhost)
  if (Platform.OS === 'ios' && !envBaseUrl?.includes('localhost') && !envBaseUrl?.includes('127.0.0.1')) {
    return 'http://127.0.0.1:4000';
  }
  // If env has localhost, convert to 127.0.0.1 for iOS
  if (Platform.OS === 'ios' && envBaseUrl?.includes('localhost')) {
    return envBaseUrl.replace('localhost', '127.0.0.1');
  }
  // For native platforms, use env var if set, otherwise default to 127.0.0.1
  return envBaseUrl ?? 'http://127.0.0.1:4000';
};

const API_BASE_URL = getBaseUrl();

/**
 * Get peak hours information for the RSF weight room
 * Fetches from the API which analyzes historical capacity data
 */
export async function getPeakHours(): Promise<PeakHoursData> {
  const url = `${API_BASE_URL}/api/peak-hours`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch peak hours: ${response.status}`);
    }
    
    const data = await response.json() as PeakHoursData;
    return data;
  } catch (error) {
    console.error('[PeakHours] Error fetching peak hours:', error);
    // Return placeholder if API fails
    return {
      hasData: false,
      message: "Unable to load peak hours data. We're collecting data to show you the best times to hit the RSF.",
    };
  }
}

