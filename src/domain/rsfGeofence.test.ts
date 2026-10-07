import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENTER_RADIUS_M,
  EXIT_RADIUS_M,
  MAX_ACCURACY_M,
  RSF_CENTER,
  distanceMeters,
  isUsableFix,
  nextPresence,
  type Fix,
} from './rsfGeofence';

/** A point `metres` due north of the RSF centre. */
const north = (metres: number, accuracy = 20): Fix => ({
  lat: RSF_CENTER.lat + metres / 111_195,
  lng: RSF_CENTER.lng,
  accuracy,
});

test('distance is accurate at campus scale', () => {
  assert.equal(Math.round(distanceMeters(RSF_CENTER, RSF_CENTER)), 0);
  // One degree of latitude is ~111.2 km.
  assert.ok(Math.abs(distanceMeters({ lat: 37, lng: -122 }, { lat: 38, lng: -122 }) - 111_195) < 200);
  assert.ok(Math.abs(distanceMeters(RSF_CENTER, north(100)) - 100) < 1);
  // Berkeley's Campanile is roughly 800 m from the RSF.
  const campanile = { lat: 37.8721, lng: -122.2578 };
  const d = distanceMeters(RSF_CENTER, campanile);
  assert.ok(d > 500 && d < 800, `campanile is ${d} m away`);
});

test('arriving needs to be inside the enter radius', () => {
  assert.equal(nextPresence('unknown', north(0)), 'in');
  assert.equal(nextPresence('out', north(ENTER_RADIUS_M - 5)), 'in');
  assert.equal(nextPresence('out', north(ENTER_RADIUS_M + 30)), 'out');
  assert.equal(nextPresence('unknown', north(5000)), 'out');
});

test('leaving needs to pass the wider exit radius (no flip-flopping at the edge)', () => {
  assert.equal(nextPresence('in', north(ENTER_RADIUS_M + 30)), 'in', 'still counted as there');
  assert.equal(nextPresence('in', north(EXIT_RADIUS_M - 5)), 'in');
  assert.equal(nextPresence('in', north(EXIT_RADIUS_M + 30)), 'out');
  // Once out, coming back needs the smaller radius again.
  assert.equal(nextPresence('out', north(ENTER_RADIUS_M + 30)), 'out');
});

test('vague or invalid readings never change the state', () => {
  for (const previous of ['in', 'out', 'unknown'] as const) {
    assert.equal(nextPresence(previous, north(0, MAX_ACCURACY_M + 1)), previous, 'too imprecise');
    assert.equal(nextPresence(previous, { lat: NaN, lng: 0, accuracy: 10 }), previous);
    assert.equal(nextPresence(previous, { lat: 0, lng: 200, accuracy: 10 }), previous);
    assert.equal(nextPresence(previous, { lat: 91, lng: 0, accuracy: 10 }), previous);
    assert.equal(nextPresence(previous, { lat: 37.8, lng: -122.2, accuracy: -5 }), previous);
    assert.equal(nextPresence(previous, { lat: 37.8, lng: -122.2, accuracy: Infinity }), previous);
  }
});

test('usable fixes', () => {
  assert.equal(isUsableFix(north(0, 10)), true);
  assert.equal(isUsableFix(north(0, MAX_ACCURACY_M)), true);
  assert.equal(isUsableFix(north(0, MAX_ACCURACY_M + 0.1)), false);
});

test('the RSF centre is where the building is (Berkeley, near Bancroft Way)', () => {
  assert.ok(RSF_CENTER.lat > 37.86 && RSF_CENTER.lat < 37.88);
  assert.ok(RSF_CENTER.lng > -122.27 && RSF_CENTER.lng < -122.25);
});
