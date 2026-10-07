import assert from 'node:assert/strict';
import test from 'node:test';

import { friendlyGoalError, isValidGoal, progressMessage, weekProgress, weekStreak } from './weeklyGoal';

// Week of Mon 2026-10-05 .. Sun 2026-10-11. Stored dates are noon UTC on the picked day.
const d = (iso: string) => `${iso}T12:00:00.000Z`;
const TUE = new Date(2026, 9, 6, 15, 0);    // Tuesday Oct 6
const SUN = new Date(2026, 9, 11, 21, 0);   // Sunday Oct 11
const MON_NEXT = new Date(2026, 9, 12, 9, 0);

test('counts distinct days this week only', () => {
  const dates = [d('2026-10-05'), d('2026-10-05'), d('2026-10-06'), d('2026-10-04'), d('2026-10-12')];
  const p = weekProgress(dates, 4, TUE);
  assert.equal(p.done, 2, 'two workouts on Monday count once; last Sunday and next Monday do not count');
  assert.equal(p.remaining, 2);
  assert.equal(p.complete, false);
  assert.equal(p.daysLeft, 6, 'Tuesday through Sunday');
  assert.equal(p.reachable, true);
});

test('completion, and an unreachable goal late in the week', () => {
  const hit = weekProgress([d('2026-10-05'), d('2026-10-07')], 2, TUE);
  assert.equal(hit.complete, true);
  assert.equal(hit.remaining, 0);
  const late = weekProgress([d('2026-10-05')], 4, SUN);
  assert.equal(late.daysLeft, 1);
  assert.equal(late.remaining, 3);
  assert.equal(late.reachable, false);
  assert.equal(weekProgress([], 7, new Date(2026, 9, 5, 8)).reachable, true, 'Monday: all seven still possible');
});

test('a new week starts empty on Monday', () => {
  const p = weekProgress([d('2026-10-09'), d('2026-10-10')], 3, MON_NEXT);
  assert.equal(p.done, 0);
  assert.equal(p.daysLeft, 7);
});

test('ignores malformed dates', () => {
  assert.equal(weekProgress(['garbage', '', '2026-13-99x', d('2026-10-06')], 3, TUE).done, 1);
});

test('week streak counts consecutive completed weeks', () => {
  const dates = [
    d('2026-10-05'), d('2026-10-06'), // this week: 2
    d('2026-09-28'), d('2026-09-29'), d('2026-09-30'), // last week: 3
    d('2026-09-21'), d('2026-09-22'), // two weeks ago: 2
    d('2026-09-14'), // three weeks ago: 1 (breaks at goal 2)
    d('2026-09-07'), d('2026-09-08'), // four weeks ago: a goal week BEFORE the gap must not be counted
  ];
  assert.equal(weekStreak(dates, 2, TUE), 3, 'this week (2) + last (3) + two ago (2); three ago misses');
  assert.equal(weekStreak(dates, 3, TUE), 1, 'goal 3: this week (2 days) is not done and not counted; last week (3) counts; two weeks ago (2) ends it');
});

test('an unfinished current week does not break the streak', () => {
  const dates = [d('2026-09-28'), d('2026-09-29'), d('2026-09-21'), d('2026-09-22')];
  assert.equal(weekStreak(dates, 2, TUE), 2, 'last two weeks hit it; this week has none yet');
});

test('no goal reached ever means no streak', () => {
  assert.equal(weekStreak([], 3, TUE), 0);
});

test('goal validation', () => {
  for (const ok of [1, 4, 7]) assert.equal(isValidGoal(ok), true);
  for (const bad of [0, 8, -1, 2.5, NaN, '3', null, undefined]) assert.equal(isValidGoal(bad), false);
});

test('messages', () => {
  assert.equal(progressMessage(weekProgress([d('2026-10-05'), d('2026-10-06')], 2, TUE)), 'Goal hit this week!');
  assert.equal(progressMessage(weekProgress([d('2026-10-05')], 3, TUE)), '2 more days to go, 6 days left.');
  assert.equal(progressMessage(weekProgress([d('2026-10-05'), d('2026-10-06')], 3, SUN)), '1 more day to go, and today is the last day.');
  assert.match(progressMessage(weekProgress([d('2026-10-05')], 4, SUN)), /Next week is a fresh start/);
  assert.match(friendlyGoalError('invalid_goal'), /1 and 7/);
});
