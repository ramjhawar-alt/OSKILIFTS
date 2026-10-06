// Must be set before any Date is constructed.
process.env.TZ = 'America/Los_Angeles';

import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidDateString, localDateString, toStoredWorkoutDate } from './dates';

test('6pm Pacific on Oct 4 is Oct 4 locally even though it is Oct 5 in UTC', () => {
  const sixPm = new Date('2026-10-05T01:00:00Z'); // 6:00 PM PDT on Oct 4
  assert.equal(sixPm.toISOString().split('T')[0], '2026-10-05'); // the old (buggy) answer
  assert.equal(localDateString(sixPm), '2026-10-04');
});

test('local date across the DST boundary', () => {
  assert.equal(localDateString(new Date('2026-11-01T08:30:00Z')), '2026-11-01'); // 1:30 AM PDT
  assert.equal(localDateString(new Date('2026-11-01T09:30:00Z')), '2026-11-01'); // 1:30 AM PST
  assert.equal(localDateString(new Date('2026-03-08T09:59:00Z')), '2026-03-08');
});

test('date validation', () => {
  assert.ok(isValidDateString('2026-02-28'));
  assert.ok(!isValidDateString('2026-02-30'));
  assert.ok(!isValidDateString('2026-13-01'));
  assert.ok(!isValidDateString('26-1-1'));
  assert.ok(!isValidDateString('2026-1-01'));
});

test('stored dates are noon UTC of the chosen day', () => {
  assert.equal(toStoredWorkoutDate('2026-10-04'), '2026-10-04T12:00:00.000Z');
});
