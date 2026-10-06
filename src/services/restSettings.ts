import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_REST_SEC, clampSeconds } from '../domain/restTimer';

// Device-local on purpose: whether you want a timer is a per-device taste.
const KEY = '@oskilifts:restTimer';

export interface RestSettings {
  enabled: boolean;
  seconds: number;
}

export const DEFAULT_REST_SETTINGS: RestSettings = { enabled: true, seconds: DEFAULT_REST_SEC };

export async function loadRestSettings(): Promise<RestSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_REST_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled !== false,
      seconds: typeof parsed?.seconds === 'number' ? clampSeconds(parsed.seconds) : DEFAULT_REST_SEC,
    };
  } catch {
    return DEFAULT_REST_SETTINGS;
  }
}

export async function saveRestSettings(settings: RestSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[RestTimer] save failed:', error);
  }
}
