import { Platform } from 'react-native';
import Constants from 'expo-constants';

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

// Helper to extract IP from Expo dev server URL
const getNetworkIP = (): string | null => {
  try {
    // Try to get IP from Expo Constants
    // Check both expoConfig (newer) and manifest (older) for hostUri
    const hostUri = Constants.expoConfig?.hostUri || 
                    Constants.manifest?.hostUri ||
                    Constants.expoConfig?.extra?.hostUri;
    
    if (hostUri) {
      // hostUri format: "192.168.1.100:8081" or "exp://192.168.1.100:8081" or "192.168.1.100"
      const match = hostUri.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        const ip = match[1];
        // Filter out localhost and common non-routable IPs
        if (ip !== '127.0.0.1' && ip !== '0.0.0.0' && !ip.startsWith('169.254.')) {
          return ip;
        }
      }
    }
    
    // Fallback: Try to get IP from debuggerHost (Expo's debugger URL)
    const debuggerHost = Constants.expoConfig?.debuggerHost || Constants.manifest?.debuggerHost;
    if (debuggerHost) {
      const match = debuggerHost.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        const ip = match[1];
        if (ip !== '127.0.0.1' && ip !== '0.0.0.0' && !ip.startsWith('169.254.')) {
          return ip;
        }
      }
    }
  } catch (error) {
    console.warn('[PeakHours API] Error detecting network IP:', error);
  }
  return null;
};

// For iOS simulator, always use 127.0.0.1 (more reliable than localhost)
// For physical devices, use network IP from Expo dev server
// For web, use localhost in dev, env var in production
const getBaseUrl = () => {
  // Priority 1: Use env var if set (highest priority)
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (Platform.OS === 'web') {
    // For web: always use localhost in development (Expo web dev server)
    // Only use env var in production builds (deployed to Vercel)
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname !== 'localhost' && 
       window.location.hostname !== '127.0.0.1' &&
       !window.location.hostname.includes('192.168.') &&
       !window.location.hostname.includes('172.16.'));
    
    // In production (Vercel), use env var if set, otherwise fallback to Render URL
    if (isProduction) {
      return 'https://oskilifts.onrender.com';
    }
    
    // In development (Expo web), ALWAYS use localhost
    return 'http://localhost:4000';
  }

  // For native platforms (iOS/Android)
  // Check if we're in a simulator/emulator (hostUri will be localhost/127.0.0.1)
  const networkIP = getNetworkIP();
  const isSimulator = !networkIP || 
    networkIP === '127.0.0.1' || 
    networkIP === 'localhost' ||
    Constants.executionEnvironment === 'storeClient'; // Production builds

  if (isSimulator) {
    // Simulator/emulator: use localhost
    return 'http://127.0.0.1:4000';
  }

  // Physical device: use network IP from Expo dev server
  if (networkIP) {
    return `http://${networkIP}:4000`;
  }

  // Fallback: try localhost (shouldn't happen, but just in case)
  console.warn('[PeakHours API] Could not determine network IP, falling back to localhost. Set EXPO_PUBLIC_OSKILIFTS_API_URL env var if this fails.');
  return 'http://127.0.0.1:4000';
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

