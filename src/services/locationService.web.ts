import type { Fix } from '../domain/rsfGeofence';

export type LocationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** Web: asks the browser; never prompts. */
export async function getLocationPermission(): Promise<LocationPermission> {
  if (!supported()) return 'unavailable';
  try {
    const result = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (!result) return 'undetermined';
    return result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/** Triggers the browser's own permission prompt by taking one reading. */
export async function requestLocationPermission(): Promise<LocationPermission> {
  if (!supported()) return 'unavailable';
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) => resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'granted'),
      { timeout: 20_000, maximumAge: 60_000 },
    );
  });
}

/** One reading, with a time limit. Rejects if there is no usable position. */
export function getCurrentFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!supported()) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => reject(new Error(error.message || 'Location unavailable')),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}
