import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { WeightRoomStatus, ClassScheduleResponse } from '../types/api';
import { getCached, setCached, CACHE_KEYS, CACHE_EXPIRY } from './cache';

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
    console.warn('[API] Error detecting network IP:', error);
  }
  return null;
};

// For iOS simulator, always use 127.0.0.1 (more reliable than localhost)
// For physical devices, use network IP from Expo dev server or env var
// For web, use localhost in dev, env var in production
const getBaseUrl = () => {
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
      return envBaseUrl || 'https://oskilifts.onrender.com';
    }
    
    // In development (Expo web), ALWAYS use localhost (ignore env var)
    return 'http://localhost:4000';
  }

  // For native platforms (iOS/Android)
  const networkIP = getNetworkIP();
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || '';
  const debuggerHost = Constants.expoConfig?.debuggerHost || Constants.manifest?.debuggerHost || '';
  
  // Log for debugging
  console.log(`[API] hostUri: ${hostUri}, debuggerHost: ${debuggerHost}, networkIP: ${networkIP}, envBaseUrl: ${envBaseUrl}`);
  
  // If env var is set, assume it's for a physical device and use it
  // (env var should only be set when testing on physical devices)
  if (envBaseUrl) {
    console.log(`[API] Using env var (physical device): ${envBaseUrl}`);
    return envBaseUrl;
  }
  
  // Simulator detection: hostUri/debuggerHost will be localhost/127.0.0.1 in simulator
  // Physical device: hostUri/debuggerHost will have a real network IP
  const isSimulator = 
    (hostUri && (hostUri.includes('127.0.0.1') || hostUri.includes('localhost'))) ||
    (debuggerHost && (debuggerHost.includes('127.0.0.1') || debuggerHost.includes('localhost'))) ||
    (!hostUri && !debuggerHost && !networkIP) || // No network info at all = likely simulator
    Constants.executionEnvironment === 'storeClient'; // Production builds

  if (isSimulator) {
    // Simulator/emulator: use localhost
    console.log(`[API] Detected simulator, using localhost`);
    return 'http://127.0.0.1:4000';
  }

  // Physical device: use network IP from Expo dev server
  if (networkIP) {
    const url = `http://${networkIP}:4000`;
    console.log(`[API] Using auto-detected network IP for physical device: ${url}`);
    return url;
  }

  // Fallback: try localhost (shouldn't happen, but just in case)
  console.warn('[API] Could not determine network IP, falling back to localhost. Set EXPO_PUBLIC_OSKILIFTS_API_URL env var if this fails.');
  return 'http://127.0.0.1:4000';
};

const API_BASE_URL = getBaseUrl();

// Log for debugging
const networkIP = getNetworkIP();
console.log(`[API] Base URL: ${API_BASE_URL} (Platform: ${Platform.OS}, Network IP: ${networkIP || 'not detected'}, Env: ${envBaseUrl || 'not set'})`);

async function handleResponse<T>(response: Response, url: string): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  
  // Check content type before parsing
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Get the text to see what we actually got (clone first so we can still parse if it's JSON)
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    if (__DEV__) {
      console.error(`[API] Expected JSON but got ${contentType} from ${url}`);
      console.error(`[API] Response preview: ${text.substring(0, 200)}`);
    }
    throw new Error(`Server returned ${contentType || 'non-JSON'} instead of JSON from ${url}`);
  }
  
  return response.json() as Promise<T>;
}

export async function fetchWeightRoomStatus(
  useCache: boolean = true,
): Promise<WeightRoomStatus> {
  const url = `${API_BASE_URL}/api/weightroom`;
  
  // Try to get cached data first (instant load)
  if (useCache) {
    const cached = await getCached<WeightRoomStatus>(CACHE_KEYS.WEIGHT_ROOM);
    if (cached) {
      console.log(`[API] Using cached weight room status`);
      // Fetch fresh data in background (don't wait for it)
      fetchWeightRoomStatus(false).catch(() => {
        // Silently fail background refresh
      });
      return cached;
    }
  }
  
  console.log(`[API] Fetching weight room status from: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (increased for network latency)
    const response = await fetch(url, {
      signal: controller.signal,
      // Add headers to help with debugging
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);
    const data = await handleResponse<WeightRoomStatus>(response, url);
    
    // Cache the fresh data
    await setCached(CACHE_KEYS.WEIGHT_ROOM, data, CACHE_EXPIRY.WEIGHT_ROOM);
    
    return data;
  } catch (error) {
    console.error(`[API] Fetch error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      const networkIP = getNetworkIP();
      const errorMsg = `Request timed out connecting to ${url}.\n\n` +
        `Troubleshooting:\n` +
        `1. Make sure "npm run server" is running in a terminal\n` +
        `2. Ensure your phone and computer are on the same WiFi network\n` +
        `3. Detected network IP: ${networkIP || 'none'}\n` +
        `4. If auto-detection fails, set EXPO_PUBLIC_OSKILIFTS_API_URL=http://YOUR_COMPUTER_IP:4000 in .env\n` +
        `   Find your IP: ifconfig | grep "inet " | grep -v 127.0.0.1`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}

export async function fetchClassSchedule(
  startDate?: string,
  useCache: boolean = true,
): Promise<ClassScheduleResponse> {
  let url = `${API_BASE_URL}/api/classes`;
  if (startDate) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}startDate=${encodeURIComponent(startDate)}`;
  }
  
  // Create cache key that includes startDate if provided
  const cacheKey = startDate 
    ? `${CACHE_KEYS.CLASSES}:${startDate}`
    : CACHE_KEYS.CLASSES;
  
  // Try to get cached data first (instant load)
  if (useCache) {
    const cached = await getCached<ClassScheduleResponse>(cacheKey);
    if (cached) {
      console.log(`[API] Using cached class schedule`);
      // Fetch fresh data in background (don't wait for it)
      fetchClassSchedule(startDate, false).catch(() => {
        // Silently fail background refresh
      });
      return cached;
    }
  }
  
  console.log(`[API] Fetching class schedule from: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await handleResponse<ClassScheduleResponse>(response, url);
    
    // Cache the fresh data
    await setCached(cacheKey, data, CACHE_EXPIRY.CLASSES);
    
    return data;
  } catch (error) {
    console.error(`[API] Fetch error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      const networkIP = getNetworkIP();
      const errorMsg = `Request timed out connecting to ${url}.\n\n` +
        `Troubleshooting:\n` +
        `1. Make sure "npm run server" is running in a terminal\n` +
        `2. Ensure your phone and computer are on the same WiFi network\n` +
        `3. Detected network IP: ${networkIP || 'none'}\n` +
        `4. If auto-detection fails, set EXPO_PUBLIC_OSKILIFTS_API_URL=http://YOUR_COMPUTER_IP:4000 in .env\n` +
        `   Find your IP: ifconfig | grep "inet " | grep -v 127.0.0.1`;
      throw new Error(errorMsg);
    }
    throw error;
  }
}
