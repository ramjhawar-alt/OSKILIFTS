import assert from 'node:assert/strict';
import test from 'node:test';

import { PRESS_STEPS } from '../config/oskiAnimation';

test('a rep fills exactly one cycle', () => {
  const total = PRESS_STEPS.reduce((sum, step) => sum + step.over, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `fractions add up to ${total}`);
});

test('a rep starts and ends at lockout, and visits the middle and the bottom', () => {
  assert.equal(PRESS_STEPS[0].to, 0);
  assert.equal(PRESS_STEPS[PRESS_STEPS.length - 1].to, 0);
  assert.ok(PRESS_STEPS.some((step) => step.to === 2));
  assert.ok(PRESS_STEPS.filter((step) => step.to === 1).length >= 2, 'passes the middle going down and going up');
});

test('it only ever moves one frame at a time, so no frame is skipped', () => {
  for (let i = 1; i < PRESS_STEPS.length; i++) {
    assert.ok(Math.abs(PRESS_STEPS[i].to - PRESS_STEPS[i - 1].to) <= 1, `step ${i}`);
  }
  assert.ok(Math.abs(PRESS_STEPS[0].to - PRESS_STEPS[PRESS_STEPS.length - 1].to) <= 1, 'loops cleanly');
});

test('lowering is slower than pressing', () => {
  const down = PRESS_STEPS.slice(1, 4).reduce((sum, step) => sum + step.over, 0);
  const up = PRESS_STEPS.slice(5, 8).reduce((sum, step) => sum + step.over, 0);
  assert.ok(down > up);
});

test('every step lasts long enough to be a real timing', () => {
  for (const step of PRESS_STEPS) assert.ok(step.over > 0);
});
