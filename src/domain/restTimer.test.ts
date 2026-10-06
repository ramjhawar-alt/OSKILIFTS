import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjustRest,
  clampSeconds,
  formatRemaining,
  idleTimer,
  nextPreset,
  remainingMs,
  shouldAlert,
  startRest,
} from './restTimer';

test('remaining time derives from timestamps, not tick counts', () => {
  const timer = startRest(1_000_000, 90);
  assert.equal(remainingMs(timer, 1_000_000), 90_000);
  assert.equal(remainingMs(timer, 1_045_000), 45_000);
  assert.equal(remainingMs(timer, 9_000_000), 0); // after a long background pause
  assert.equal(remainingMs(idleTimer(), 5), 0);
});

test('alerts exactly once per rest', () => {
  let timer = startRest(0, 60);
  assert.equal(shouldAlert(timer, 59_999), false);
  assert.equal(shouldAlert(timer, 60_000), true);
  timer = { ...timer, alerted: true };
  assert.equal(shouldAlert(timer, 120_000), false);
  assert.equal(shouldAlert(idleTimer(), 1e12), false);
});

test('adjusting extends or shortens and re-arms the alert', () => {
  let timer = startRest(0, 60);
  timer = adjustRest(timer, 10_000, 15);
  assert.equal(remainingMs(timer, 10_000), 65_000);
  timer = adjustRest(timer, 10_000, -300);
  assert.equal(remainingMs(timer, 10_000), 0);
  const finished = { endsAt: 1000, alerted: true };
  assert.equal(adjustRest(finished, 5000, 15).alerted, false);
  assert.deepEqual(adjustRest(idleTimer(), 0, 15), idleTimer());
});

test('clamping, formatting and presets', () => {
  assert.equal(clampSeconds(1), 5);
  assert.equal(clampSeconds(99999), 1800);
  assert.equal(formatRemaining(90_000), '1:30');
  assert.equal(formatRemaining(1), '0:01');
  assert.equal(formatRemaining(0), '0:00');
  assert.equal(nextPreset(120), 180);
  assert.equal(nextPreset(300), 60);
  assert.equal(nextPreset(77), 90);
});
