import { Platform } from 'react-native';
import type { WeightRoomStatus, ClassScheduleResponse } from '../types/api';

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
    // In production builds (deployed to Vercel), use the env var
    // In development (Expo dev server), use localhost
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname !== 'localhost' && 
       window.location.hostname !== '127.0.0.1' &&
       !window.location.hostname.includes('192.168.') &&
       !window.location.hostname.includes('172.16.'));
    
    if (isProduction && envBaseUrl) {
      // Production build: use env var (set in Vercel)
      return envBaseUrl;
    }
    
    // Development: use localhost since Expo web dev server and API server run on same machine
    // The network IP (like 172.16.224.18) is only needed for physical devices, not web browser
    // Using localhost avoids firewall/network connectivity issues
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

export async function fetchWeightRoomStatus(): Promise<WeightRoomStatus> {
  const url = `${API_BASE_URL}/api/weightroom`;
  console.log(`[API] Fetching weight room status from: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return handleResponse<WeightRoomStatus>(response, url);
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
): Promise<ClassScheduleResponse> {
  let url = `${API_BASE_URL}/api/classes`;
  if (startDate) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}startDate=${encodeURIComponent(startDate)}`;
  }
  console.log(`[API] Fetching class schedule from: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return handleResponse<ClassScheduleResponse>(response, url);
  } catch (error) {
    console.error(`[API] Fetch error for ${url}:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running at ' + url + '?');
    }
    throw error;
  }
}
