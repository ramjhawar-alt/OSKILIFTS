import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertDraftUnit,
  countUncheckedWithData,
  createDraft,
  draftFromWorkout,
  draftReducer,
  draftToEntries,
  parseSet,
  parseStoredDraft,
  serializeDraft,
  type DraftWorkout,
} from './draft';
import { entriesToStored, normalizeEntries } from './entry';
import { lbToKg } from './units';
import type { Workout } from '../types/workout';

const BENCH = { name: 'Bench Press', isCustom: false, muscleGroup: 'Chest' };
const PLANK = { name: 'Plank', isCustom: false, muscleGroup: 'Core' };
const RUN = { name: 'Running', isCustom: false, muscleGroup: 'Cardio' };
const PULLUPS = { name: 'Pull-ups', isCustom: false, muscleGroup: 'Back' };

function start(unit: 'lb' | 'kg' = 'lb'): DraftWorkout {
  return createDraft({ date: '2026-10-04', unit, now: 1 });
}

function withBench(unit: 'lb' | 'kg' = 'lb') {
  const draft = draftReducer(start(unit), { type: 'addEntries', exercises: [BENCH] });
  return { draft, entryId: draft.entries[0].id, setIds: draft.entries[0].sets.map((s) => s.id) };
}

function fill(draft: DraftWorkout, entryId: string, setId: string, weightText: string, repsText: string) {
  return draftReducer(draft, { type: 'patchSet', entryId, setId, patch: { weightText, repsText } });
}

test('adding an exercise creates stable-id rows by type', () => {
  let draft = draftReducer(start(), { type: 'addEntries', exercises: [BENCH, PLANK, RUN, PULLUPS] });
  assert.equal(draft.entries.length, 4);
  assert.deepEqual(draft.entries.map((e) => e.exercise.type), ['weight_reps', 'duration', 'distance_duration', 'bodyweight_reps']);
  assert.deepEqual(draft.entries.map((e) => e.sets.length), [3, 1, 1, 3]);
  const ids = draft.entries.flatMap((e) => [e.id, ...e.sets.map((s) => s.id)]);
  assert.equal(new Set(ids).size, ids.length);
  // editing one row leaves every other entry referentially identical (memo-friendly)
  const before = draft.entries;
  draft = fill(draft, before[0].id, before[0].sets[0].id, '135', '8');
  assert.notEqual(draft.entries[0], before[0]);
  assert.equal(draft.entries[1], before[1]);
  assert.equal(draft.entries[2], before[2]);
});

test('a row cannot be checked until it is valid; editing un-checks it', () => {
  let { draft, entryId, setIds } = withBench();
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[0] });
  assert.equal(draft.entries[0].sets[0].done, false); // no reps yet
  draft = fill(draft, entryId, setIds[0], '135', '8');
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[0] });
  assert.equal(draft.entries[0].sets[0].done, true);
  draft = fill(draft, entryId, setIds[0], '140', '8');
  assert.equal(draft.entries[0].sets[0].done, false);
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[0] });
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[0] });
  assert.equal(draft.entries[0].sets[0].done, false); // can be unchecked
});

test('weight is optional but must parse when typed; reps are required', () => {
  const row = (weightText: string, repsText: string) => ({ id: 'x', kind: 'normal' as const, weightText, repsText, secText: '', distText: '', done: false });
  assert.ok(parseSet('weight_reps', row('', '8'), 'lb'));
  assert.ok(parseSet('weight_reps', row('135', '8'), 'lb'));
  assert.equal(parseSet('weight_reps', row('abc', '8'), 'lb'), null);
  assert.equal(parseSet('weight_reps', row('135', ''), 'lb'), null);
  assert.equal(parseSet('weight_reps', row('135', '0'), 'lb'), null);
  assert.equal(parseSet('weight_reps', row('135', '1000'), 'lb'), null);
  assert.equal(parseSet('weight_reps', row('135', '8.5'), 'lb'), null);
  assert.equal(parseSet('weight_reps', row('135', '-3'), 'lb'), null);
  assert.equal(parseSet('weight_reps', row('135,5', '8'), 'lb')?.kg, lbToKg(135.5));
});

test('add set copies the previous row unchecked; warm-up copies become normal', () => {
  let { draft, entryId, setIds } = withBench();
  draft = fill(draft, entryId, setIds[2], '185', '5');
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[2] });
  draft = draftReducer(draft, { type: 'addSet', entryId });
  const rows = draft.entries[0].sets;
  assert.equal(rows.length, 4);
  assert.equal(rows[3].weightText, '185');
  assert.equal(rows[3].repsText, '5');
  assert.equal(rows[3].done, false);
  draft = draftReducer(draft, { type: 'cycleKind', entryId, setId: rows[3].id });
  assert.equal(draft.entries[0].sets[3].kind, 'warmup');
  draft = draftReducer(draft, { type: 'addSet', entryId });
  assert.equal(draft.entries[0].sets[4].kind, 'normal');
  draft = draftReducer(draft, { type: 'removeLastSet', entryId });
  assert.equal(draft.entries[0].sets.length, 4);
});

test('kind cycles normal -> warmup -> drop -> failure -> normal', () => {
  let { draft, entryId, setIds } = withBench();
  const kinds: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    draft = draftReducer(draft, { type: 'cycleKind', entryId, setId: setIds[0] });
    kinds.push(draft.entries[0].sets[0].kind);
  }
  assert.deepEqual(kinds, ['warmup', 'drop', 'failure', 'normal']);
});

test('saving keeps only checked sets, in the per-set shape, with kg stored', () => {
  let { draft, entryId, setIds } = withBench('lb');
  draft = fill(draft, entryId, setIds[0], '95', '10');
  draft = draftReducer(draft, { type: 'cycleKind', entryId, setId: setIds[0] });
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[0] });
  draft = fill(draft, entryId, setIds[1], '185', '8');
  draft = draftReducer(draft, { type: 'toggleDone', entryId, setId: setIds[1] });
  draft = fill(draft, entryId, setIds[2], '195', '5'); // typed but never checked
  assert.equal(countUncheckedWithData(draft), 1);

  const { entries, errors, discardedUnchecked } = draftToEntries(draft);
  assert.deepEqual(errors, []);
  assert.equal(discardedUnchecked, 1);
  assert.equal(entries.length, 1);
  const [stored] = entriesToStored(entries) as any[];
  assert.equal(stored.v, 2);
  assert.deepEqual(stored.log, [
    { kg: lbToKg(95), reps: 10, kind: 'warmup' },
    { kg: lbToKg(185), reps: 8 },
  ]);
  assert.deepEqual({ sets: stored.sets, reps: stored.reps }, { sets: 1, reps: 8 });
  assert.equal(stored.exercise.type, 'weight_reps');
});

test('cardio and duration rows', () => {
  let draft = draftReducer(start('lb'), { type: 'addEntries', exercises: [PLANK, RUN] });
  const [plank, run] = draft.entries;
  draft = draftReducer(draft, { type: 'patchSet', entryId: plank.id, setId: plank.sets[0].id, patch: { secText: '1:30' } });
  draft = draftReducer(draft, { type: 'toggleDone', entryId: plank.id, setId: plank.sets[0].id });
  draft = draftReducer(draft, { type: 'patchSet', entryId: run.id, setId: run.sets[0].id, patch: { distText: '3', secText: '25:00' } });
  draft = draftReducer(draft, { type: 'toggleDone', entryId: run.id, setId: run.sets[0].id });
  const { entries, errors } = draftToEntries(draft);
  assert.deepEqual(errors, []);
  const stored = entriesToStored(entries) as any[];
  assert.deepEqual(stored[0].log, [{ sec: 90 }]);
  assert.deepEqual(stored[1].log, [{ sec: 1500, m: 4828.03 }]);
});

test('saving with nothing completed is an error; a checked invalid row is an error', () => {
  const { draft } = withBench();
  assert.match(draftToEntries(draft).errors[0], /at least one set/);
  const bad = { ...draft, entries: [{ ...draft.entries[0], sets: [{ ...draft.entries[0].sets[0], done: true, repsText: 'x' }] }] };
  assert.match(draftToEntries(bad).errors[0], /Bench Press: set 1/);
});

test('editing an old workout: untouched legacy entries round-trip byte-identical; touched ones convert', () => {
  const legacyRaw = [
    { exercise: { name: 'Squat', isCustom: false, muscleGroup: 'Legs' }, sets: 3, reps: [10, 8, 8] },
    { exercise: { name: 'Leg Press', isCustom: false, muscleGroup: 'Legs' }, sets: 2, reps: 12 },
  ];
  const workout: Workout = {
    id: '11111111-1111-1111-1111-111111111111',
    date: '2026-09-30T12:00:00.000Z',
    dayType: { name: 'Legs', isCustom: false },
    exercises: normalizeEntries(legacyRaw),
    visibility: 'followers',
  };
  let draft = draftFromWorkout(workout, 'lb');
  assert.equal(draft.entries[0].sets.length, 3);
  assert.deepEqual(draft.entries[0].sets.map((s) => s.repsText), ['10', '8', '8']);
  assert.ok(draft.entries.every((e) => e.sets.every((s) => s.done && s.weightText === '')));

  // untouched -> identical
  let converted = draftToEntries(draft);
  assert.equal(JSON.stringify(entriesToStored(converted.entries)), JSON.stringify(legacyRaw));

  // add a weight to Squat's first set -> only Squat converts to v2
  const squat = draft.entries[0];
  draft = draftReducer(draft, { type: 'patchSet', entryId: squat.id, setId: squat.sets[0].id, patch: { weightText: '225' } });
  draft = draftReducer(draft, { type: 'toggleDone', entryId: squat.id, setId: squat.sets[0].id });
  converted = draftToEntries(draft);
  const stored = entriesToStored(converted.entries) as any[];
  assert.equal(stored[0].v, 2);
  assert.equal(stored[0].log[0].kg, lbToKg(225));
  assert.deepEqual(stored[0].log.map((s: any) => s.reps), [10, 8, 8]);
  assert.equal(JSON.stringify(stored[1]), JSON.stringify(legacyRaw[1]));
});

test('switching units converts typed weights through kg', () => {
  let { draft, entryId, setIds } = withBench('lb');
  draft = fill(draft, entryId, setIds[0], '225', '5');
  const kg = convertDraftUnit(draft, 'kg');
  assert.equal(kg.unit, 'kg');
  assert.equal(kg.entries[0].sets[0].weightText, '102.06');
  const back = convertDraftUnit(kg, 'lb');
  assert.equal(back.entries[0].sets[0].weightText, '225');
  assert.equal(convertDraftUnit(draft, 'lb'), draft);
});

test('draft persistence format round-trips and rejects junk', () => {
  const { draft } = withBench();
  assert.deepEqual(parseStoredDraft(serializeDraft(draft)), draft);
  for (const bad of [null, '', 'not json', '{}', '{"v":99}', JSON.stringify({ ...draft, v: 2 }), JSON.stringify({ ...draft, unit: 'stone' }), JSON.stringify({ ...draft, entries: 'x' })]) {
    assert.equal(parseStoredDraft(bad), null, String(bad).slice(0, 30));
  }
});

test('limits: 40 exercises, 30 sets per exercise', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ name: `E${i}`, isCustom: true }));
  let draft = draftReducer(start(), { type: 'addEntries', exercises: many });
  assert.equal(draft.entries.length, 40);
  const entryId = draft.entries[0].id;
  for (let i = 0; i < 40; i += 1) draft = draftReducer(draft, { type: 'addSet', entryId });
  assert.equal(draft.entries[0].sets.length, 30);
});

test('replacing an exercise of a different type resets the columns', () => {
  let { draft, entryId, setIds } = withBench();
  draft = fill(draft, entryId, setIds[0], '135', '8');
  draft = draftReducer(draft, { type: 'replaceExercise', entryId, exercise: PLANK });
  assert.equal(draft.entries[0].exercise.type, 'duration');
  assert.equal(draft.entries[0].sets.length, 1);
  assert.equal(draft.entries[0].sets[0].weightText, '');
  const same = draftReducer(withBench().draft, { type: 'replaceExercise', entryId: withBench().entryId, exercise: BENCH });
  assert.ok(same);
});

test('check-all completes only rows that are valid and have data', () => {
  let { draft, entryId, setIds } = withBench();
  draft = fill(draft, entryId, setIds[0], '135', '8');
  draft = fill(draft, entryId, setIds[1], '135', 'x');
  draft = draftReducer(draft, { type: 'checkAllValid' });
  assert.deepEqual(draft.entries[0].sets.map((s) => s.done), [true, false, false]);
});

test('applyHint fills empty fields (check) or overwrites (tap previous); can complete', () => {
  let { draft, entryId, setIds } = withBench();
  const hint = { weightText: '185', repsText: '5', secText: '', distText: '' };
  draft = fill(draft, entryId, setIds[0], '', '');
  draft = draftReducer(draft, { type: 'applyHint', entryId, setId: setIds[0], hint, overwrite: false, complete: true });
  assert.deepEqual([draft.entries[0].sets[0].weightText, draft.entries[0].sets[0].repsText, draft.entries[0].sets[0].done], ['185', '5', true]);

  draft = fill(draft, entryId, setIds[1], '200', '');
  draft = draftReducer(draft, { type: 'applyHint', entryId, setId: setIds[1], hint, overwrite: false, complete: true });
  assert.deepEqual([draft.entries[0].sets[1].weightText, draft.entries[0].sets[1].repsText], ['200', '5']); // typed weight kept

  draft = draftReducer(draft, { type: 'applyHint', entryId, setId: setIds[2], hint, overwrite: true, complete: false });
  assert.deepEqual([draft.entries[0].sets[2].weightText, draft.entries[0].sets[2].done], ['185', false]);

  draft = fill(draft, entryId, setIds[2], '', '');
  const bad = { weightText: '', repsText: '', secText: '', distText: '' };
  draft = draftReducer(draft, { type: 'applyHint', entryId, setId: setIds[2], hint: bad, overwrite: false, complete: true });
  assert.equal(draft.entries[0].sets[2].done, false); // a hint that can't complete the row doesn't
});
