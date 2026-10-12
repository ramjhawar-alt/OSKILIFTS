import assert from 'node:assert/strict';
import test from 'node:test';

import { bearModeFor, mapFriendRow, safeStage, stayLabel } from './rsfFriends';

test('the bear lifts only while at the RSF', () => {
  assert.equal(bearModeFor('at'), 'lift');
  for (const status of ['off', 'starting', 'away', 'denied', 'unavailable', '', 'AT']) {
    assert.equal(bearModeFor(status), 'idle', status);
  }
});

test('a missing or junk stage becomes stage 1, and real ones are clamped', () => {
  assert.equal(safeStage(undefined), 1);
  assert.equal(safeStage(null), 1);
  assert.equal(safeStage('x'), 1);
  assert.equal(safeStage(Number.NaN), 1);
  assert.equal(safeStage(0), 1);
  assert.equal(safeStage(-4), 1);
  assert.equal(safeStage(3), 3);
  assert.equal(safeStage('7'), 7);
  assert.equal(safeStage(4.9), 4);
  assert.equal(safeStage(99), 10);
});

test('server rows map to friends, with or without a stage (older server)', () => {
  const row = { id: 'a', username: 'bob', display_name: 'Bob', arrived_at: '2026-10-11T10:00:00Z', expires_at: '2026-10-11T10:25:00Z' };
  assert.deepEqual(mapFriendRow({ ...row, stage: 4 }), {
    id: 'a', username: 'bob', displayName: 'Bob', arrivedAt: row.arrived_at, expiresAt: row.expires_at, stage: 4,
  });
  assert.equal(mapFriendRow(row).stage, 1);
  assert.equal(mapFriendRow({ ...row, display_name: null }).displayName, null);
});

test('time at the RSF reads in minutes, then hours', () => {
  const t0 = Date.parse('2026-10-11T10:00:00Z');
  assert.equal(stayLabel('2026-10-11T10:00:00Z', t0), '1 min', 'just arrived is 1 min, never 0');
  assert.equal(stayLabel('2026-10-11T10:00:00Z', t0 + 12 * 60000), '12 min');
  assert.equal(stayLabel('2026-10-11T10:00:00Z', t0 + 59 * 60000), '59 min');
  assert.equal(stayLabel('2026-10-11T10:00:00Z', t0 + 60 * 60000), '1 hr');
  assert.equal(stayLabel('2026-10-11T10:00:00Z', t0 + 135 * 60000), '2 hr');
  assert.equal(stayLabel('not a date', t0), '1 min');
  assert.equal(stayLabel('2026-10-11T11:00:00Z', t0), '1 min', 'a clock a little behind never goes negative');
});
