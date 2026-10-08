import assert from 'node:assert/strict';
import test from 'node:test';

import { getBearStage, getBearStageName, getStreakForNextStage } from '../services/bearStreakService';

test('ten workouts per stage', () => {
  const cases: [number, number][] = [
    [0, 1], [1, 1], [9, 1], [10, 2], [19, 2], [20, 3], [29, 3], [30, 4], [39, 4],
    [40, 5], [49, 5], [50, 6], [59, 6], [60, 7], [69, 7], [70, 8], [79, 8],
    [80, 9], [89, 9], [90, 10], [91, 10], [500, 10],
  ];
  for (const [streak, stage] of cases) assert.equal(getBearStage(streak), stage, `streak ${streak}`);
});

test('the next stage needs the next multiple of ten, and max has none', () => {
  for (let stage = 1; stage < 10; stage++) assert.equal(getStreakForNextStage(stage), stage * 10);
  assert.equal(getStreakForNextStage(10), null);
  for (let stage = 1; stage < 10; stage++) {
    const need = getStreakForNextStage(stage) as number;
    assert.equal(getBearStage(need), stage + 1, 'reaching the number moves up');
    assert.equal(getBearStage(need - 1), stage, 'one short stays');
  }
});

test('bad input falls back to the first stage', () => {
  assert.equal(getBearStage(-5), 1);
  assert.equal(getBearStage(Number.NaN), 1);
  assert.equal(getBearStage(Infinity), 1);
});

test('names run Baby Oski to MAX OSKI', () => {
  assert.equal(getBearStageName(1), 'Baby Oski');
  assert.equal(getBearStageName(2), 'Small Oski');
  assert.equal(getBearStageName(10), 'MAX OSKI');
});
