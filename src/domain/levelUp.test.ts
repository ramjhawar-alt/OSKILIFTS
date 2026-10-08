import assert from 'node:assert/strict';
import test from 'node:test';

import { decideLevelUp, levelUpCopy, levelUpKey } from './levelUp';

test('the first time we see someone we only remember their stage', () => {
  assert.deepEqual(decideLevelUp(null, 1), { celebrate: false, remember: 1 });
  assert.deepEqual(decideLevelUp(null, 6), { celebrate: false, remember: 6 });
});

test('a higher stage than ever before is celebrated and remembered', () => {
  assert.deepEqual(decideLevelUp('1', 2), { celebrate: true, remember: 2 });
  assert.deepEqual(decideLevelUp('3', 4), { celebrate: true, remember: 4 });
});

test('the same stage is not celebrated again', () => {
  assert.deepEqual(decideLevelUp('4', 4), { celebrate: false, remember: 4 });
});

test('a streak that broke and rebuilt does not repeat the celebration', () => {
  assert.deepEqual(decideLevelUp('5', 2), { celebrate: false, remember: 5 });
  assert.deepEqual(decideLevelUp('5', 5), { celebrate: false, remember: 5 });
});

test('jumping several stages celebrates once, at the new stage', () => {
  assert.deepEqual(decideLevelUp('2', 5), { celebrate: true, remember: 5 });
});

test('junk in storage is treated as nothing stored', () => {
  for (const junk of ['', 'abc', '0', '11', '-3', '2.5', 'NaN']) {
    assert.deepEqual(decideLevelUp(junk, 3), { celebrate: false, remember: 3 }, junk);
  }
});

test('out-of-range current stages are clamped', () => {
  assert.deepEqual(decideLevelUp('9', 99), { celebrate: true, remember: 10 });
  assert.deepEqual(decideLevelUp('3', 0), { celebrate: false, remember: 3 });
  assert.deepEqual(decideLevelUp('3', Number.NaN), { celebrate: false, remember: 3 });
});

test('the storage key is per person', () => {
  assert.notEqual(levelUpKey('a'), levelUpKey('b'));
  assert.ok(levelUpKey('abc').includes('abc'));
});

test('copy names the stage and the next target', () => {
  const two = levelUpCopy(2);
  assert.equal(two.title, 'LEVEL UP!');
  assert.equal(two.name, 'Small Oski');
  assert.equal(two.stageLabel, 'Stage 2 of 10');
  assert.equal(two.next, 'Next up: Young Oski at a 20-workout streak.');
});

test('the top stage says so', () => {
  const max = levelUpCopy(10);
  assert.equal(max.title, 'MAX LEVEL!');
  assert.equal(max.name, 'MAX OSKI');
  assert.ok(!max.next.includes('Next up'));
  assert.equal(levelUpCopy(99).name, 'MAX OSKI');
});
