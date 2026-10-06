import assert from 'node:assert/strict';
import test from 'node:test';

import { createDraft, draftReducer } from './draft';
import { normalizeEntries } from './entry';
import {
  cleanRoutineName,
  draftFromRoutine,
  normalizeRoutineEntries,
  routineEntriesFromDraft,
  routineEntriesFromWorkout,
  type Routine,
} from './routines';
import { lbToKg } from './units';
import type { Workout } from '../types/workout';

const workout: Workout = {
  id: 'w',
  date: '2026-10-01T12:00:00.000Z',
  dayType: { name: 'Push', isCustom: false },
  exercises: normalizeEntries([
    { v: 2, exercise: { name: 'Bench Press', isCustom: false, type: 'weight_reps' }, log: [{ kg: lbToKg(95), reps: 10, kind: 'warmup' }, { kg: lbToKg(185), reps: 5 }, { kg: lbToKg(185), reps: 5 }], sets: 2, reps: 5 },
    { exercise: { name: 'Dips', isCustom: false }, sets: 3, reps: [12, 10, 8] },
  ]),
};

test('a routine keeps structure and drops weights', () => {
  const entries = routineEntriesFromWorkout(workout);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].sets, [{ kind: 'warmup', reps: 10 }, { reps: 5 }, { reps: 5 }]);
  assert.deepEqual(entries[1].sets, [{ reps: 12 }, { reps: 10 }, { reps: 8 }]);
  assert.ok(!JSON.stringify(entries).includes('kg'));
  assert.equal(entries[1].exercise.type, 'bodyweight_reps');
});

test('starting a routine gives an unchecked, weightless draft with target reps', () => {
  const routine: Routine = { id: 'r1', name: 'Push A', dayType: { name: 'Push', isCustom: false }, entries: routineEntriesFromWorkout(workout), createdAt: '2026-10-02T00:00:00Z' };
  const draft = draftFromRoutine(routine, { unit: 'lb', date: '2026-10-06', now: 5 });
  assert.equal(draft.routineId, 'r1');
  assert.equal(draft.dayType?.name, 'Push');
  assert.equal(draft.entries.length, 2);
  assert.deepEqual(draft.entries[0].sets.map((s) => s.kind), ['warmup', 'normal', 'normal']);
  assert.deepEqual(draft.entries[0].sets.map((s) => s.repsText), ['10', '5', '5']);
  assert.ok(draft.entries.every((e) => e.sets.every((s) => !s.done && s.weightText === '')));
  const ids = draft.entries.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)]);
  assert.equal(new Set(ids).size, ids.length);
  // two starts never share row ids
  const again = draftFromRoutine(routine, { unit: 'lb', date: '2026-10-06' });
  assert.notEqual(again.entries[0].id, draft.entries[0].id);
});

test('a routine can be made from an in-progress draft', () => {
  let draft = draftReducer(createDraft({ date: '2026-10-06', unit: 'lb' }), { type: 'addEntries', exercises: [{ name: 'Squat', isCustom: false }] });
  const { id: entryId, sets } = draft.entries[0];
  draft = draftReducer(draft, { type: 'patchSet', entryId, setId: sets[0].id, patch: { weightText: '225', repsText: '5' } });
  draft = draftReducer(draft, { type: 'cycleKind', entryId, setId: sets[1].id });
  const entries = routineEntriesFromDraft(draft);
  assert.deepEqual(entries[0].sets, [{ reps: 5 }, { kind: 'warmup' }, {}]);
  assert.ok(!JSON.stringify(entries).includes('225'));
});

test('normalizeRoutineEntries never throws and clamps', () => {
  assert.deepEqual(normalizeRoutineEntries('x'), []);
  assert.deepEqual(normalizeRoutineEntries(null), []);
  const messy = normalizeRoutineEntries([
    null,
    { exercise: null },
    { exercise: { name: '   ' } },
    { exercise: { name: 'Squat' }, sets: 'nope' },
    { exercise: { name: 'Row', type: 'bogus' }, sets: [{ reps: 0 }, { reps: 1000 }, { reps: '8' }, { kind: 'x' }], restSec: 99999 },
  ]);
  assert.equal(messy.length, 2);
  assert.deepEqual(messy[0].sets, [{}]);
  assert.deepEqual(messy[1].sets, [{}, {}, { reps: 8 }, {}]);
  assert.equal(messy[1].exercise.type, undefined);
  assert.equal(messy[1].restSec, undefined);
  const big = normalizeRoutineEntries(Array.from({ length: 100 }, (_, i) => ({ exercise: { name: `E${i}` }, sets: Array.from({ length: 100 }, () => ({ reps: 5 })) })));
  assert.equal(big.length, 40);
  assert.equal(big[0].sets.length, 30);
});

test('cleanRoutineName trims, collapses whitespace and caps length', () => {
  assert.equal(cleanRoutineName('  Push   Day  A '), 'Push Day A');
  assert.equal(cleanRoutineName('x'.repeat(100)).length, 60);
});
