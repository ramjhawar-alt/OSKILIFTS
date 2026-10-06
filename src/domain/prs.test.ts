import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChartModel, filterRange, niceTicks } from './chart';
import { buildHistoryIndex, type Session } from './history';
import { normalizeEntries } from './entry';
import { computeRecords, detectPrs, e1rm, eligibleSets, metricsFor, progressSeries, stampPrs } from './prs';
import { sessionsBefore } from './history';
import { entriesToStored } from './entry';
import { lbToKg } from './units';
import type { EntryData, Workout } from '../types/workout';

const lb = lbToKg;
const set = (pounds: number, reps: number, kind?: string) => ({ kg: lb(pounds), reps, ...(kind ? { kind } : {}) });
const v2 = (name: string, log: object[], type = 'weight_reps') => ({ v: 2, exercise: { name, isCustom: false, type }, log, sets: 1, reps: 1 });
const wk = (id: string, date: string, createdAt: string, exercises: unknown[]): Workout => ({
  id, date: `${date}T12:00:00.000Z`, createdAt, dayType: { name: 'Push', isCustom: false }, exercises: normalizeEntries(exercises),
});
const sessions = (workouts: Workout[], key: string): Session[] => buildHistoryIndex(workouts).get(key) ?? [];
const entryOf = (raw: unknown): EntryData => normalizeEntries([raw])[0];

const HISTORY = [
  wk('w1', '2026-09-01', '2026-09-01T18:00:00Z', [v2('Bench Press', [set(135, 8), set(145, 5)])]),
  wk('w2', '2026-09-15', '2026-09-15T18:00:00Z', [v2('Bench Press', [set(95, 10, 'warmup'), set(155, 5), set(155, 4)])]),
];

test('e1rm uses Epley and is the weight itself for a single', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(Math.abs(e1rm(100, 10) - 133.333333) < 1e-5);
});

test('records pick the heaviest, best e1RM, and keep the earliest of equals', () => {
  const records = computeRecords(sessions(HISTORY, 'bench press'));
  assert.equal(records.heaviest?.kg, lb(155));
  assert.equal(records.heaviest?.date, '2026-09-15');
  assert.equal(records.bestE1rm?.kg, lb(155)); // 155x5 beats 145x5 and 135x8
  assert.equal(records.sessions, 2);
  assert.equal(records.lastDate, '2026-09-15');
  const tie = computeRecords(sessions([wk('a', '2026-01-01', '2026-01-01T00:00:00Z', [v2('Row', [set(100, 5)])]), wk('b', '2026-02-01', '2026-02-01T00:00:00Z', [v2('Row', [set(100, 5)])])], 'row'));
  assert.equal(tie.heaviest?.date, '2026-01-01');
});

test('warm-ups, reps-only legacy sets and unusable sets never count', () => {
  const legacy = entryOf({ exercise: { name: 'Bench Press', isCustom: false }, sets: 3, reps: 10 });
  assert.equal(eligibleSets(legacy).length, 0);
  const warmOnly = entryOf(v2('Bench Press', [set(200, 3, 'warmup')]));
  assert.equal(eligibleSets(warmOnly).length, 0);
  assert.equal(eligibleSets(entryOf(v2('Bench Press', [{ reps: 5 }]))).length, 0); // no weight
  assert.equal(eligibleSets(entryOf(v2('Running', [{ sec: 100 }], 'distance_duration'))).length, 0);
});

test('PRs: first-ever is a baseline, then strict improvements are flagged', () => {
  const prior = sessions(HISTORY, 'bench press');
  assert.deepEqual(detectPrs([], entryOf(v2('Bench Press', [set(225, 5)]))), []);
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [set(165, 3)]))), ['weight', 'e1rm']);
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [set(155, 5)]))), []); // tie
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [set(155, 6)]))), ['e1rm']); // same weight, more reps
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [set(160, 1)]))), ['weight']); // heavier single, lower e1RM than 155x5? 160*1=160 vs 155*1.1667=180.8
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [set(100, 30)]))), []); // reps > 12 never e1RM
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [set(300, 5, 'warmup')]))), []);
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', []))), []);
});

test('legacy history is never a prior best, so the first weighted session is a baseline', () => {
  const legacy = [wk('l', '2026-08-01', '2026-08-01T00:00:00Z', [{ exercise: { name: 'Bench Press', isCustom: false }, sets: 3, reps: 10 }])];
  assert.deepEqual(detectPrs(sessions(legacy, 'bench press'), entryOf(v2('Bench Press', [set(135, 8)]))), []);
});

test('unit rounding cannot create or erase a PR', () => {
  const prior = sessions([wk('p', '2026-09-01', '2026-09-01T00:00:00Z', [v2('Bench Press', [{ kg: 61.2349, reps: 5 }])])], 'bench press'); // 135 lb
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [{ kg: 61.235, reps: 5 }]))), []); // 135 lb entered again
  assert.deepEqual(detectPrs(prior, entryOf(v2('Bench Press', [{ kg: lb(135.5), reps: 5 }]))), ['weight', 'e1rm']);
});

test('bodyweight reps PR, with optional added weight', () => {
  const prior = sessions([wk('p', '2026-09-01', '2026-09-01T00:00:00Z', [v2('Pull-ups', [{ reps: 8 }, { reps: 6 }], 'bodyweight_reps')])], 'pull-ups');
  assert.deepEqual(detectPrs(prior, entryOf(v2('Pull-ups', [{ reps: 9 }], 'bodyweight_reps'))), ['reps']);
  assert.deepEqual(detectPrs(prior, entryOf(v2('Pull-ups', [{ reps: 8 }], 'bodyweight_reps'))), []);
  assert.equal(computeRecords(prior).mostReps?.reps, 8);
  assert.deepEqual(metricsFor('bodyweight_reps'), ['reps', 'weight']);
  assert.deepEqual(metricsFor('duration'), []);
});

test('a back-dated workout is compared only to earlier history', () => {
  const index = buildHistoryIndex(HISTORY);
  const earlier = (index.get('bench press') ?? []).filter((s) => s.date < '2026-09-10');
  // before 9/10 the bests are 145 lb and e1RM 171 (135x8); 140x5 is e1RM 163, so neither
  assert.deepEqual(detectPrs(earlier, entryOf(v2('Bench Press', [set(140, 5)]))), []);
  // ...but 140x10 (e1RM 186.7) would be a PR then, even though today's best is higher
  assert.deepEqual(detectPrs(earlier, entryOf(v2('Bench Press', [set(140, 10)]))), ['e1rm']);
});

test('progress series: best per day, time-ordered, record flags', () => {
  const more = [...HISTORY, wk('w3', '2026-09-15', '2026-09-15T20:00:00Z', [v2('Bench Press', [set(150, 5)])]), wk('w4', '2026-10-01', '2026-10-01T18:00:00Z', [v2('Bench Press', [set(145, 5)])])];
  const points = progressSeries(sessions(more, 'bench press'), 'weight');
  assert.deepEqual(points.map((p) => p.date), ['2026-09-01', '2026-09-15', '2026-10-01']);
  assert.deepEqual(points.map((p) => p.isRecord), [false, true, false]); // first point is a baseline
  assert.equal(points[1].value, lb(155));
  const e = progressSeries(sessions(more, 'bench press'), 'e1rm');
  assert.ok(e.every((p) => Number.isFinite(p.value)));
});

test('niceTicks, range filter and chart model', () => {
  assert.deepEqual(niceTicks(0, 100, 4), [0, 20, 40, 60, 80, 100]);
  const ticks = niceTicks(133, 187, 4);
  assert.ok(ticks[0] <= 133 && ticks[ticks.length - 1] >= 187);
  assert.ok(niceTicks(50, 50).length >= 2);
  assert.deepEqual(niceTicks(NaN, 1), []);

  const points = progressSeries(sessions(HISTORY, 'bench press'), 'weight');
  const nowMs = Date.UTC(2026, 9, 5);
  assert.equal(filterRange(points, 'All', nowMs).length, 2);
  assert.equal(filterRange(points, '3M', nowMs).length, 2);
  assert.equal(filterRange(points, '3M', Date.UTC(2027, 3, 1)).length, 0);

  const model = buildChartModel(points, 300, 200, { left: 40, right: 10, top: 10, bottom: 20 });
  assert.equal(model.points.length, 2);
  assert.ok(model.points[0].x < model.points[1].x);
  assert.ok(model.points[1].y < model.points[0].y); // higher value, higher on screen (smaller y)
  assert.ok(model.points.every((p) => p.x >= 40 && p.x <= 290 && p.y >= 10 && p.y <= 180));
  assert.equal(buildChartModel([], 300, 200, { left: 0, right: 0, top: 0, bottom: 0 }).points.length, 0);
  const single = buildChartModel(points.slice(0, 1), 300, 200, { left: 40, right: 10, top: 10, bottom: 20 });
  assert.equal(single.points.length, 1);
  assert.ok(Number.isFinite(single.points[0].x) && Number.isFinite(single.points[0].y));
});

test('stampPrs: stamps only exercises that set records; idempotent re-stamp replaces old stamps', () => {
  const index = buildHistoryIndex(HISTORY);
  const prior = (key: string) => sessionsBefore(index, key, { date: '2026-10-05' });
  const entries = normalizeEntries([
    v2('Bench Press', [set(165, 3)]),
    v2('Squat', [set(225, 5)]),
    { exercise: { name: 'Row', isCustom: false }, sets: 3, reps: 10 },
  ]);
  entries[0].touched = true;
  const stamped = stampPrs(entries, prior);
  assert.deepEqual(stamped[0].prs, ['weight', 'e1rm']);
  assert.deepEqual(stamped[1].prs, []); // first Squat is a baseline
  assert.deepEqual(stamped[2].prs, []); // legacy entries are never stamped
  const stored = entriesToStored(stamped) as any[];
  assert.deepEqual(stored[0].prs, ['weight', 'e1rm']);
  assert.equal(stored[1].prs, undefined);
  assert.equal(JSON.stringify(stored[2]), JSON.stringify({ exercise: { name: 'Row', isCustom: false }, sets: 3, reps: 10 }));

  // Re-stamping an edited entry replaces (never accumulates) previous stamps.
  const edited = stampPrs([{ ...stamped[0], sets: normalizeEntries([v2('Bench Press', [set(135, 3)])])[0].sets }], prior);
  assert.deepEqual(edited[0].prs, []);
});

test('stampPrs: two entries of one exercise in a workout give the PR to the best set', () => {
  const index = buildHistoryIndex(HISTORY);
  const prior = (key: string) => sessionsBefore(index, key, { date: '2026-10-05' });
  const entries = normalizeEntries([v2('Bench Press', [set(135, 5)]), v2('Bench Press', [set(170, 2)])]);
  const stamped = stampPrs(entries, prior);
  assert.deepEqual(stamped[0].prs, []);
  assert.ok(stamped[1].prs.includes('weight'));
});

test('sessionsBefore respects date, createdAt and the excluded workout', () => {
  const index = buildHistoryIndex(HISTORY);
  assert.equal(sessionsBefore(index, 'bench press', { date: '2026-09-15', createdAt: '2026-09-15T18:00:00Z' }).length, 1);
  assert.equal(sessionsBefore(index, 'bench press', { date: '2026-12-01' }, 'w2').length, 1);
  assert.equal(sessionsBefore(index, 'nope', { date: '2026-12-01' }).length, 0);
});
