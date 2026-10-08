import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_REST_DAYS, workoutStreak } from './streak';

const TODAY = '2026-10-08'; // a Thursday

test('allowance is two rest days', () => {
  assert.equal(MAX_REST_DAYS, 2);
});

test('no workouts is no streak', () => {
  assert.equal(workoutStreak([], TODAY), 0);
});

test('a workout today is a streak of one', () => {
  assert.equal(workoutStreak(['2026-10-08'], TODAY), 1);
});

test('back-to-back days count one each', () => {
  assert.equal(workoutStreak(['2026-10-08', '2026-10-07', '2026-10-06'], TODAY), 3);
});

test('one rest day between workouts keeps the streak and is not counted', () => {
  assert.equal(workoutStreak(['2026-10-08', '2026-10-06', '2026-10-04'], TODAY), 3);
});

test('two rest days in a row are allowed', () => {
  assert.equal(workoutStreak(['2026-10-08', '2026-10-05', '2026-10-02'], TODAY), 3);
});

test('three rest days in a row break it, and only earlier workouts are dropped', () => {
  assert.equal(workoutStreak(['2026-10-08', '2026-10-07', '2026-10-03', '2026-10-02'], TODAY), 2);
});

test('the streak is alive while the last workout is within the allowance of today', () => {
  assert.equal(workoutStreak(['2026-10-07'], TODAY), 1, 'yesterday');
  assert.equal(workoutStreak(['2026-10-06'], TODAY), 1, '1 rest day so far');
  assert.equal(workoutStreak(['2026-10-05'], TODAY), 1, '2 rest days so far, still alive today');
  assert.equal(workoutStreak(['2026-10-04'], TODAY), 0, 'a third rest day has passed');
});

test('several workouts on one day count once', () => {
  assert.equal(workoutStreak(['2026-10-08', '2026-10-08', '2026-10-08T12:00:00.000Z'], TODAY), 1);
});

test('stored noon-UTC timestamps work', () => {
  assert.equal(workoutStreak(['2026-10-08T12:00:00.000Z', '2026-10-06T12:00:00.000Z'], TODAY), 2);
});

test('future dates and junk are ignored', () => {
  assert.equal(workoutStreak(['2026-10-20', 'not a date', '2026-13-45', '', '2026-10-08'], TODAY), 1);
  assert.equal(workoutStreak(['2026-10-20'], TODAY), 0, 'only a future workout is no streak');
});

test('input order does not matter', () => {
  assert.equal(workoutStreak(['2026-10-02', '2026-10-08', '2026-10-05'], TODAY), 3);
});

test('a long steady chain with weekly rest days adds up', () => {
  // Train Mon-Thu-Sat style: gaps of 1 and 2 rest days, 12 weeks.
  const dates: string[] = [];
  const start = Date.UTC(2026, 6, 20);
  for (let week = 0; week < 12; week++) {
    for (const offset of [0, 2, 4]) {
      const d = new Date(start + (week * 7 + offset) * 86_400_000);
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  assert.equal(workoutStreak(dates, '2026-10-12'), 36);
});

test('works across month and year boundaries and DST dates', () => {
  assert.equal(workoutStreak(['2027-01-01', '2026-12-30', '2026-12-28'], '2027-01-01'), 3);
  assert.equal(workoutStreak(['2026-03-09', '2026-03-07', '2026-03-05'], '2026-03-09'), 3, 'US spring-forward weekend');
});

test('a custom allowance is respected', () => {
  assert.equal(workoutStreak(['2026-10-08', '2026-10-06'], TODAY, 0), 1);
  assert.equal(workoutStreak(['2026-10-08', '2026-10-06'], TODAY, 1), 2);
});

test('an impossible date that would roll over into the past is rejected, not shifted', () => {
  assert.equal(workoutStreak(['2026-09-31'], '2026-10-02'), 0, 'Sept 31 is not Oct 1');
});
