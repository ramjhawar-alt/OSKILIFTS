import { Platform } from 'react-native';
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

console.log(`[API] Base URL: ${API_BASE_URL} (Platform: ${Platform.OS}, Env: ${envBaseUrl || 'not set'})`);

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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await handleResponse<WeightRoomStatus>(response, url);
    
    // Cache the fresh data
    await setCached(CACHE_KEYS.WEIGHT_ROOM, data, CACHE_EXPIRY.WEIGHT_ROOM);
    
    return data;
  } catch (error) {
    console.error(`[API] Fetch error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + url + '?');
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
      throw new Error('Request timed out. Is the server running at ' + url + '?');
    }
    throw error;
  }
}
