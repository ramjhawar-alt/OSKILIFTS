import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

const CACHE_PREFIX = '@oskilifts:cache:';

/**
 * Get cached data if it exists and hasn't expired
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache has expired
    if (age > entry.expiresIn) {
      // Cache expired, remove it
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error(`[Cache] Error getting cached data for ${key}:`, error);
    return null;
  }
}

/**
 * Store data in cache with expiration time
 */
export async function setCached<T>(
  key: string,
  data: T,
  expiresInMs: number,
): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: expiresInMs,
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error(`[Cache] Error caching data for ${key}:`, error);
  }
}

/**
 * Clear a specific cache entry
 */
export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error(`[Cache] Error clearing cache for ${key}:`, error);
  }
}

/**
 * Clear all cache entries
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('[Cache] Error clearing all cache:', error);
  }
}

// Cache keys
export const CACHE_KEYS = {
  WEIGHT_ROOM: 'weightroom',
  CLASSES: 'classes',
  HOOPERS: 'hoopers',
} as const;

// Cache expiration times (in milliseconds)
export const CACHE_EXPIRY = {
  WEIGHT_ROOM: 2 * 60 * 1000, // 2 minutes (capacity changes frequently)
  CLASSES: 30 * 60 * 1000, // 30 minutes (class schedule changes less frequently)
  HOOPERS: 30 * 1000, // 30 seconds (hoopers status changes frequently)
} as const;

