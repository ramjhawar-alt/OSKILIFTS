import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHistoryIndex, hintForRow, lastPerformance, setHintFrom } from './history';
import { normalizeEntries } from './entry';
import { lbToKg } from './units';
import type { Workout } from '../types/workout';

function workout(id: string, date: string, createdAt: string, exercises: unknown[]): Workout {
  return { id, date: `${date}T12:00:00.000Z`, createdAt, dayType: { name: 'Push', isCustom: false }, exercises: normalizeEntries(exercises) };
}
const bench = (log: object[]) => ({ v: 2, exercise: { name: 'Bench Press', isCustom: false, type: 'weight_reps' }, log, sets: 1, reps: 1 });
const s = (lb: number, reps: number, kind?: string) => ({ kg: lbToKg(lb), reps, ...(kind ? { kind } : {}) });

const W = [
  workout('w3', '2026-10-03', '2026-10-03T20:00:00Z', [bench([s(95, 10, 'warmup'), s(185, 5), s(185, 5)])]),
  workout('w2', '2026-10-01', '2026-10-01T20:00:00Z', [bench([s(175, 8)])]),
  workout('w1', '2026-09-28', '2026-09-28T20:00:00Z', [{ exercise: { name: 'Bench Press', isCustom: false }, sets: 3, reps: 10 }]),
  workout('wx', '2026-10-03', '2026-10-03T09:00:00Z', [bench([s(135, 12)])]),
];

test('index is newest first by date then createdAt', () => {
  const index = buildHistoryIndex(W);
  assert.deepEqual(index.get('bench press')!.map((x) => x.workoutId), ['w3', 'wx', 'w2', 'w1']);
});

test('lastPerformance is strictly before the given moment', () => {
  const index = buildHistoryIndex(W);
  const before = (date: string, createdAt?: string, exclude?: string) =>
    lastPerformance(index, 'bench press', { date, createdAt }, exclude)?.workoutId;
  assert.equal(before('2026-10-05'), 'w3');
  assert.equal(before('2026-10-03', '2026-10-03T21:00:00Z'), 'w3'); // same day, later
  assert.equal(before('2026-10-03', '2026-10-03T12:00:00Z'), 'wx'); // same day, between
  assert.equal(before('2026-10-03', '2026-10-03T08:00:00Z'), 'w2');
  assert.equal(before('2026-10-02'), 'w2'); // back-dated entry ignores later sessions
  assert.equal(before('2026-09-01'), undefined);
  assert.equal(before('2026-10-05', undefined, 'w3'), 'wx'); // editing w3 excludes itself
  assert.equal(lastPerformance(index, 'squat', { date: '2026-10-05' }), undefined);
});

test('hints align warm-ups with warm-ups and working with working, reusing the last', () => {
  const index = buildHistoryIndex(W);
  const prev = lastPerformance(index, 'bench press', { date: '2026-10-05' })!.entry.sets;
  const rows = [{ kind: 'warmup' as const }, { kind: 'normal' as const }, { kind: 'normal' as const }, { kind: 'normal' as const }, { kind: 'warmup' as const }];
  const hint = (i: number) => hintForRow(prev, rows, i, 'weight_reps', 'lb');
  assert.equal(hint(0)?.summary, '95×10');
  assert.equal(hint(1)?.summary, '185×5');
  assert.equal(hint(2)?.summary, '185×5');
  assert.equal(hint(3)?.summary, '185×5'); // beyond previous count -> last working set
  assert.equal(hint(4), null); // second warm-up: no previous warm-up to reuse
  assert.equal(hintForRow([], rows, 0, 'weight_reps', 'lb'), null);
});

test('legacy sessions give reps-only hints; units and types format correctly', () => {
  const index = buildHistoryIndex(W);
  const legacy = lastPerformance(index, 'bench press', { date: '2026-09-30' })!.entry.sets;
  assert.equal(setHintFrom(legacy[0], 'weight_reps', 'lb').summary, '10 reps');
  const set = { kg: lbToKg(225), reps: 3, kind: 'normal' as const, rpe: null, sec: null, m: null };
  assert.equal(setHintFrom(set, 'weight_reps', 'lb').summary, '225×3');
  assert.equal(setHintFrom(set, 'weight_reps', 'kg').summary, '102.06×3');
  assert.equal(setHintFrom(set, 'bodyweight_reps', 'lb').summary, '+225×3');
  assert.equal(setHintFrom({ ...set, kg: null }, 'bodyweight_reps', 'lb').summary, 'BW×3');
  assert.equal(setHintFrom({ ...set, kg: null, reps: null, sec: 90, m: 4828.03 }, 'distance_duration', 'lb').summary, '3 · 1:30');
});
