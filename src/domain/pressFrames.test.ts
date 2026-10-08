import assert from 'node:assert/strict';
import test from 'node:test';

import { barKnots, fadeWindows } from './pressFrames';

test('knots follow the bar: first is 0, last is 1, others are proportional', () => {
  const knots = barKnots([496, 531, 609, 641, 684]);
  assert.equal(knots[0], 0);
  assert.equal(knots[knots.length - 1], 1);
  assert.ok(Math.abs(knots[1] - 35 / 188) < 1e-9);
  assert.ok(Math.abs(knots[2] - 113 / 188) < 1e-9);
  assert.ok(Math.abs(knots[3] - 145 / 188) < 1e-9);
});

test('knots never go backwards, even if a picture is measured out of order', () => {
  const knots = barKnots([500, 540, 520, 600, 700]);
  for (let i = 1; i < knots.length; i++) assert.ok(knots[i] >= knots[i - 1], `knot ${i}`);
  assert.equal(knots[knots.length - 1], 1);
});

test('bad or flat measurements fall back to even spacing', () => {
  assert.deepEqual(barKnots([100, 100, 100]), [0, 0.5, 1]);
  assert.deepEqual(barKnots([10, 20, 30]), [0, 0.5, 1], 'under 20px of travel');
  assert.deepEqual(barKnots([1, Number.NaN, 300]), [0, 0.5, 1]);
  assert.deepEqual(barKnots([5]), [0]);
  assert.deepEqual(barKnots([]), []);
});

test('there is one fade window per picture after the first', () => {
  const windows = fadeWindows(barKnots([496, 531, 609, 641, 684]));
  assert.equal(windows.length, 4);
});

test('each window is hidden at lockout, shown at the bottom, and ascends', () => {
  for (const w of fadeWindows(barKnots([496, 531, 609, 641, 684]))) {
    assert.equal(w.input.length, w.output.length);
    assert.deepEqual([...w.input].sort((a, b) => a - b), w.input);
    assert.equal(w.output[0], 0);
    assert.equal(w.output[w.output.length - 1], 1);
  }
});

test('a picture is fully in before the next one starts to appear', () => {
  const knots = barKnots([496, 531, 609, 641, 684]);
  const windows = fadeWindows(knots);
  for (let k = 0; k < windows.length - 1; k++) {
    assert.ok(windows[k].input[2] <= windows[k + 1].input[1], `picture ${k + 1} is in before ${k + 2} starts`);
  }
});

test('the blend happens around the point the bar reaches the picture', () => {
  const knots = barKnots([0, 100, 300]);
  const [first] = fadeWindows(knots);
  assert.ok(first.input[1] > 0 && first.input[2] < knots[1], 'fully in before the bar reaches it');
});
