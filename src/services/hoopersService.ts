import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  HoopersData,
  CheckInResponse,
  CheckOutResponse,
  CheckInStatusResponse,
} from '../types/hoopers';
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
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
    if (hostUri) {
      // hostUri format: "192.168.1.100:8081" or "exp://192.168.1.100:8081"
      const match = hostUri.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        return match[1];
      }
    }
  } catch (error) {
    // Ignore errors
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
  console.warn('[Hoopers API] Could not determine network IP, falling back to localhost. Set EXPO_PUBLIC_OSKILIFTS_API_URL env var if this fails.');
  return 'http://127.0.0.1:4000';
};

const API_BASE_URL = getBaseUrl();

const USER_ID_KEY = '@oskilifts:hoopersUserId';

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
      console.error(`[Hoopers API] Expected JSON but got ${contentType} from ${url}`);
      console.error(`[Hoopers API] Response preview: ${text.substring(0, 200)}`);
    }
    throw new Error(`Server returned ${contentType || 'non-JSON'} instead of JSON from ${url}`);
  }
  
  return response.json() as Promise<T>;
}

/**
 * Generate or retrieve a unique user ID for this device
 */
export async function getOrCreateUserId(): Promise<string> {
  try {
    let userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = `hooper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  } catch (error) {
    // Fallback to session-based ID if AsyncStorage fails
    return `hooper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Get current hoopers status (count and crowdedness level)
 */
export async function getHoopersStatus(useCache: boolean = true): Promise<HoopersData> {
  const url = `${API_BASE_URL}/api/hoopers`;
  
  // Try to get cached data first (instant load)
  if (useCache) {
    const cached = await getCached<HoopersData>(CACHE_KEYS.HOOPERS);
    if (cached) {
      console.log(`[Hoopers API] Using cached hoopers status`);
      // Fetch fresh data in background (don't wait for it)
      getHoopersStatus(false).catch(() => {
        // Silently fail background refresh
      });
      return cached;
    }
  }
  
  console.log(`[Hoopers API] Fetching hoopers status from: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await handleResponse<HoopersData>(response, url);
    
    // Cache the fresh data
    await setCached(CACHE_KEYS.HOOPERS, data, CACHE_EXPIRY.HOOPERS);
    
    return data;
  } catch (error) {
    console.error(`[Hoopers API] Fetch error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + url + '?');
    }
    throw error;
  }
}

/**
 * Check in as playing basketball
 */
export async function checkIn(userId: string): Promise<CheckInResponse> {
  const url = `${API_BASE_URL}/api/hoopers/checkin`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return handleResponse<CheckInResponse>(response, url);
  } catch (error) {
    console.error(`[Hoopers API] Check-in error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + url + '?');
    }
    throw error;
  }
}

/**
 * Check out from playing basketball
 */
export async function checkOut(userId: string): Promise<CheckOutResponse> {
  const url = `${API_BASE_URL}/api/hoopers/checkout`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return handleResponse<CheckOutResponse>(response, url);
  } catch (error) {
    console.error(`[Hoopers API] Check-out error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + url + '?');
    }
    throw error;
  }
}

/**
 * Check if a user is currently checked in
 */
export async function getCheckInStatus(userId: string): Promise<CheckInStatusResponse> {
  const url = `${API_BASE_URL}/api/hoopers/status/${userId}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return handleResponse<CheckInStatusResponse>(response, url);
  } catch (error) {
    console.error(`[Hoopers API] Status check error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + url + '?');
    }
    throw error;
  }
}

