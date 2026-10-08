import assert from 'node:assert/strict';
import test from 'node:test';

import { barHeights, parseMetrics, percent, sumOf, trend } from './metrics';

test('parses a complete document', () => {
  const m = parseMetrics({
    days: 30,
    totals: { users: 12, onboarded: 10, public_accounts: 3, workouts: 40, active_7d: 6, active_prev_7d: 4, follows: 20, open_reports: 1 },
    adoption: { leaderboard: 2, weekly_recap: 5, weekly_goals: 4, hoopers_now: 1, at_rsf_now: 0, heading_now: 2 },
    funnel: { signups: 8, onboarded: 7, logged_workout: 5, followed_someone: 6, returned_after_week: 2 },
    invites: { total: 3, in_period: 2, top: [{ username: 'ram_lifts', count: 2 }] },
    daily: [{ day: '2026-10-07', signups: 1, workouts: 4, active: 3 }],
  });
  assert.equal(m.totals.publicAccounts, 3);
  assert.equal(m.funnel.returnedAfterWeek, 2);
  assert.deepEqual(m.invites.top, [{ username: 'ram_lifts', count: 2 }]);
  assert.deepEqual(m.daily[0], { day: '2026-10-07', signups: 1, workouts: 4, active: 3 });
});

test('never throws on junk and turns bad numbers into zero', () => {
  for (const junk of [null, undefined, 5, 'x', [], {}, { totals: 'no', daily: 'no', invites: { top: [null, 3, { username: 7 }] } }, { totals: { users: -4, workouts: NaN, follows: 'many' } }]) {
    const m = parseMetrics(junk);
    assert.equal(m.totals.users, 0);
    assert.deepEqual(m.daily.length, 0);
    assert.ok(Array.isArray(m.invites.top));
  }
  assert.equal(parseMetrics({ totals: { users: 7.9 } }).totals.users, 7);
});

test('caps list sizes and string lengths', () => {
  const m = parseMetrics({
    daily: Array.from({ length: 500 }, (_, i) => ({ day: '2026-10-07-extra-long', signups: i })),
    invites: { top: Array.from({ length: 50 }, () => ({ username: 'x'.repeat(100), count: 1 })) },
  });
  assert.equal(m.daily.length, 90);
  assert.equal(m.daily[0].day.length, 10);
  assert.equal(m.invites.top.length, 5);
  assert.equal(m.invites.top[0].username.length, 20);
});

test('percentages', () => {
  assert.equal(percent(1, 4), '25%');
  assert.equal(percent(0, 4), '0%');
  assert.equal(percent(4, 4), '100%');
  assert.equal(percent(5, 4), '100%', 'never above 100');
  assert.equal(percent(3, 0), '—');
  assert.equal(percent(0, 0), '—');
});

test('week over week trends', () => {
  assert.deepEqual(trend(6, 4), { direction: 'up', label: 'up 2 (+50%) vs last week' });
  assert.deepEqual(trend(2, 4), { direction: 'down', label: 'down 2 (-50%) vs last week' });
  assert.deepEqual(trend(3, 3), { direction: 'flat', label: 'same as last week' });
  assert.deepEqual(trend(5, 0), { direction: 'new', label: 'up 5 from none last week' });
  assert.deepEqual(trend(0, 0), { direction: 'flat', label: 'same as last week' });
});

test('bar heights and sums', () => {
  assert.deepEqual(barHeights([0, 5, 10]), [0, 0.5, 1]);
  assert.deepEqual(barHeights([0, 0]), [0, 0]);
  assert.deepEqual(barHeights([]), []);
  assert.equal(sumOf([1, 2, 3]), 6);
  assert.equal(sumOf([]), 0);
});
