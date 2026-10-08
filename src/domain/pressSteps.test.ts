import assert from 'node:assert/strict';
import test from 'node:test';

import { PRESS_REP_MS, PRESS_STEPS } from '../config/oskiAnimation';

test('a rep fills exactly one cycle', () => {
  const total = PRESS_STEPS.reduce((sum, step) => sum + step.over, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `fractions add up to ${total}`);
});

test('a rep goes to the bottom and ends at lockout', () => {
  assert.ok(PRESS_STEPS.some((step) => step.to === 1));
  assert.equal(PRESS_STEPS[PRESS_STEPS.length - 1].to, 0);
});

test('the bar is always moving: strokes dominate and beats are short', () => {
  let moving = 0;
  let previous = 0;
  for (const step of PRESS_STEPS) {
    if (step.to !== previous) moving += step.over;
    else assert.ok(step.over <= 0.12, 'a beat at either end is brief');
    previous = step.to;
  }
  assert.ok(moving >= 0.8, `${moving} of the rep is movement`);
});

test('lowering is not rushed compared with pressing', () => {
  const [down, , up] = PRESS_STEPS;
  assert.equal(down.to, 1);
  assert.equal(up.to, 0);
  assert.ok(down.over < up.over + 0.05);
});

test('a rep takes a lively but readable time', () => {
  assert.ok(PRESS_REP_MS >= 1200 && PRESS_REP_MS <= 2500);
});
