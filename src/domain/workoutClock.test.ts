import assert from 'node:assert/strict';
import test from 'node:test';

import { countDoneSets, formatElapsed } from './workoutClock';

test('elapsed time reads m:ss, then h:mm:ss', () => {
  assert.equal(formatElapsed(0), '0:00');
  assert.equal(formatElapsed(999), '0:00');
  assert.equal(formatElapsed(1000), '0:01');
  assert.equal(formatElapsed(59_000), '0:59');
  assert.equal(formatElapsed(60_000), '1:00');
  assert.equal(formatElapsed(754_000), '12:34');
  assert.equal(formatElapsed(3_600_000), '1:00:00');
  assert.equal(formatElapsed(3_729_000), '1:02:09');
});

test('a clock slightly behind or junk input never goes negative or breaks', () => {
  assert.equal(formatElapsed(-5000), '0:00');
  assert.equal(formatElapsed(Number.NaN), '0:00');
  assert.equal(formatElapsed(Infinity), '0:00');
});

test('counts only checked sets, across exercises', () => {
  assert.equal(countDoneSets([]), 0);
  assert.equal(
    countDoneSets([
      { sets: [{ done: true }, { done: false }, { done: true }] },
      { sets: [{ done: false }] },
      { sets: [{ done: true }] },
    ]),
    3,
  );
});
