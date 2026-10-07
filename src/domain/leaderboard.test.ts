import assert from 'node:assert/strict';
import test from 'node:test';

import { daysLabel, rankRows, weekRangeLabel, weekStart, type BoardRow } from './leaderboard';

const row = (username: string, days: number, isMe = false): BoardRow => ({
  id: username, username, displayName: null, days, isMe,
});

test('ties share a rank and the next rank skips', () => {
  const ranked = rankRows([row('c', 3), row('a', 5), row('b', 3), row('d', 0)]);
  assert.deepEqual(ranked.map((r) => [r.username, r.rank]), [['a', 1], ['b', 2], ['c', 2], ['d', 4]]);
});

test('everyone at zero days ties for first', () => {
  assert.deepEqual(rankRows([row('b', 0), row('a', 0)]).map((r) => r.rank), [1, 1]);
  assert.deepEqual(rankRows([]), []);
});

test('ranking does not mutate its input', () => {
  const input = [row('b', 1), row('a', 2)];
  rankRows(input);
  assert.deepEqual(input.map((r) => r.username), ['b', 'a']);
});

test('day labels', () => {
  assert.equal(daysLabel(0), '0 days');
  assert.equal(daysLabel(1), '1 day');
  assert.equal(daysLabel(6), '6 days');
});

test('weeks run Monday to Sunday', () => {
  // 2026-10-06 is a Tuesday; its week starts Monday Oct 5.
  assert.equal(weekStart(new Date(2026, 9, 6, 15, 30)).getDate(), 5);
  assert.equal(weekStart(new Date(2026, 9, 5, 0, 1)).getDate(), 5, 'Monday is its own week start');
  assert.equal(weekStart(new Date(2026, 9, 11, 23, 59)).getDate(), 5, 'Sunday belongs to the week that began Monday');
  assert.equal(weekStart(new Date(2026, 9, 12, 8, 0)).getDate(), 12, 'the next Monday starts a new week');
  assert.equal(weekRangeLabel(new Date(2026, 9, 6)), 'Oct 5 – Oct 11');
  assert.equal(weekRangeLabel(new Date(2026, 9, 30)), 'Oct 26 – Nov 1', 'crosses a month');
});
