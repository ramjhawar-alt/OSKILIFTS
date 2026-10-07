import * as Location from 'expo-location';

import type { Fix } from '../domain/rsfGeofence';

export type LocationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Native: foreground ("while using the app") location only. */
export async function getLocationPermission(): Promise<LocationPermission> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

export async function requestLocationPermission(): Promise<LocationPermission> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** One reading, with a time limit. Rejects if there is no usable position. */
export async function getCurrentFix(): Promise<Fix> {
  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Location timed out')), 15_000)),
  ]);
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? Number.POSITIVE_INFINITY,
  };
}
