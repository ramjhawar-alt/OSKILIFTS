// The RSF presence check runs on the phone. Coordinates never leave this module:
// the only thing sent to the server is "at the RSF" / "not".

/** Recreational Sports Facility, 2301 Bancroft Way (OpenStreetMap centre of the building). */
export const RSF_CENTER = { lat: 37.8687085, lng: -122.262765 };

/** Counts as arrived inside this radius (the building is ~90 x 70 m; GPS drifts indoors). */
export const ENTER_RADIUS_M = 120;
/** Once there, only counts as left beyond this radius, so edge jitter doesn't flip-flop. */
export const EXIT_RADIUS_M = 220;
/** Readings less precise than this say nothing useful either way. */
export const MAX_ACCURACY_M = 150;

export interface Fix {
  lat: number;
  lng: number;
  /** Radius of uncertainty in metres. */
  accuracy: number;
}

export type Presence = 'in' | 'out' | 'unknown';

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isUsableFix(fix: Fix): boolean {
  return (
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.lng) &&
    Number.isFinite(fix.accuracy) &&
    Math.abs(fix.lat) <= 90 &&
    Math.abs(fix.lng) <= 180 &&
    fix.accuracy >= 0 &&
    fix.accuracy <= MAX_ACCURACY_M
  );
}

/**
 * Next presence state from the previous one and a new reading. A bad or vague
 * reading leaves the state unchanged.
 */
export function nextPresence(previous: Presence, fix: Fix): Presence {
  if (!isUsableFix(fix)) return previous;
  const distance = distanceMeters(RSF_CENTER, fix);
  if (previous === 'in') return distance <= EXIT_RADIUS_M ? 'in' : 'out';
  return distance <= ENTER_RADIUS_M ? 'in' : 'out';
}
