import assert from 'node:assert/strict';
import test from 'node:test';

import { PRESS_FADE, PRESS_REP_MS, PRESS_STEPS } from '../config/oskiAnimation';

test('a rep fills exactly one cycle', () => {
  const total = PRESS_STEPS.reduce((sum, step) => sum + step.over, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `fractions add up to ${total}`);
});

test('a rep starts at the bottom stroke and ends at lockout, reaching the bottom', () => {
  assert.equal(PRESS_STEPS[PRESS_STEPS.length - 1].to, 0);
  assert.ok(PRESS_STEPS.some((step) => step.to === 2));
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

test('lowering is slower than pressing', () => {
  const [down, , up] = PRESS_STEPS;
  assert.ok(down.over < up.over + 0.05);
  assert.equal(down.to, 2);
  assert.equal(up.to, 0);
});

test('a rep takes a lively but readable time', () => {
  assert.ok(PRESS_REP_MS >= 1200 && PRESS_REP_MS <= 2500);
});

test('pictures fade in over earlier ones and are crisp in between', () => {
  for (const key of ['middle', 'bottom'] as const) {
    const { input, output } = PRESS_FADE[key];
    assert.equal(input.length, output.length);
    assert.deepEqual([...input].sort((a, b) => a - b), input, `${key} inputs ascend`);
    assert.equal(output[0], 0, `${key} is hidden at lockout`);
    assert.equal(output[output.length - 1], 1, `${key} is fully shown at the end`);
  }
  // the middle picture is already in by the time the bottom picture starts to appear
  assert.equal(PRESS_FADE.middle.output[PRESS_FADE.middle.output.length - 1], 1);
  assert.ok(PRESS_FADE.middle.input[2] <= PRESS_FADE.bottom.input[1]);
});
