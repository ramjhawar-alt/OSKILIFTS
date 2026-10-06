import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  MAX_SETS,
  entriesToStored,
  entryFromLegacy,
  exerciseKey,
  legacyProjection,
  normalizeEntries,
} from './entry';
import { formatExerciseEntry, formatReps } from './format';

// The exact formula the app used before this change.
function oldFormat(entry: { sets: number; reps: number | number[] }): string {
  return `${entry.sets} sets × ${Array.isArray(entry.reps) ? entry.reps.join(', ') : entry.reps} reps`;
}

const LEGACY_CORPUS = [
  { exercise: { name: 'Squat', isCustom: false, muscleGroup: 'Legs' }, sets: 3, reps: 10 },
  { exercise: { name: 'Bench Press', isCustom: false, muscleGroup: 'Chest' }, sets: 3, reps: [8, 8, 6] },
  { exercise: { name: 'My Curl', isCustom: true }, sets: 4, reps: [12, 10, 10, 8] },
  { exercise: { name: 'Plank', isCustom: false, muscleGroup: 'Core' }, sets: 1, reps: 1 },
  { exercise: { name: 'Pull-ups', isCustom: false, muscleGroup: 'Back' }, sets: 5, reps: 5 },
];

test('golden: legacy entries render exactly as before', () => {
  for (const raw of LEGACY_CORPUS) {
    const [entry] = normalizeEntries([raw]);
    assert.equal(formatExerciseEntry(entry), oldFormat(raw), raw.exercise.name);
    assert.equal(formatReps(raw.reps), Array.isArray(raw.reps) ? raw.reps.join(', ') : String(raw.reps));
  }
});

test('golden: untouched legacy entries are written back byte-identical', () => {
  const entries = normalizeEntries(LEGACY_CORPUS);
  assert.equal(JSON.stringify(entriesToStored(entries)), JSON.stringify(LEGACY_CORPUS));
});

test('entries built from the old picker are written in the old shape', () => {
  const entry = entryFromLegacy({ name: 'Squat', isCustom: false, muscleGroup: 'Legs' }, 3, [8, 8, 6]);
  assert.deepEqual(entriesToStored([entry]), [
    { exercise: { name: 'Squat', isCustom: false, muscleGroup: 'Legs' }, sets: 3, reps: [8, 8, 6] },
  ]);
  assert.deepEqual(legacyProjection(entry), { sets: 3, reps: [8, 8, 6] });
});

test('legacy entries become one set row per rep with no weight', () => {
  const [entry] = normalizeEntries([LEGACY_CORPUS[1]]);
  assert.equal(entry.sets.length, 3);
  assert.deepEqual(entry.sets.map((s) => s.reps), [8, 8, 6]);
  assert.ok(entry.sets.every((s) => s.kg === null));
  assert.equal(entry.exercise.type, 'weight_reps');
  const [plank] = normalizeEntries([LEGACY_CORPUS[3]]);
  assert.equal(plank.exercise.type, 'duration');
});

test('legacy oddities: null/NaN reps, zero sets, string numbers', () => {
  const entries = normalizeEntries([
    { exercise: { name: 'A', isCustom: false }, sets: 3, reps: [10, null, NaN] },
    { exercise: { name: 'B', isCustom: false }, sets: 0, reps: 10 },
    { exercise: { name: 'C', isCustom: false }, sets: '4', reps: '12' },
  ]);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0].sets.map((s) => s.reps), [10, null, null]);
  assert.equal(entries[1].sets.length, 1);
  assert.equal(entries[2].sets.length, 4);
  assert.equal(entries[2].sets[0].reps, 12);
  assert.doesNotThrow(() => formatExerciseEntry(entries[0]));
});

const V2 = {
  v: 2,
  exercise: { name: 'Bench Press', isCustom: false, muscleGroup: 'Chest', type: 'weight_reps' },
  log: [
    { kg: 61.2349, reps: 10, kind: 'warmup' },
    { kg: 83.9146, reps: 8 },
    { kg: 83.9146, reps: 8 },
    { kg: 88.4505, reps: 5 },
  ],
  prs: ['e1rm'],
  sets: 3,
  reps: [8, 8, 5],
};

test('v2 entries parse, ignore the legacy projection, and round-trip', () => {
  const [entry] = normalizeEntries([V2]);
  assert.equal(entry.legacy, null);
  assert.equal(entry.sets.length, 4);
  assert.equal(entry.sets[0].kind, 'warmup');
  assert.deepEqual(entry.prs, ['e1rm']);
  const [stored] = entriesToStored([entry]) as any[];
  assert.deepEqual(stored, V2);
  assert.deepEqual(legacyProjection(entry), { sets: 3, reps: [8, 8, 5] });
});

test('a v2 entry with garbage sets/reps projection is read from log only', () => {
  const [entry] = normalizeEntries([{ ...V2, sets: 'lots', reps: { nope: 1 } }]);
  assert.equal(entry.sets.length, 4);
});

test('v2 summaries in lb and kg', () => {
  const [entry] = normalizeEntries([V2]);
  assert.equal(formatExerciseEntry(entry, 'lb'), '185×8, 185×8, 195×5 lb (+1 warm-up)');
  assert.equal(formatExerciseEntry(entry, 'kg'), '83.91×8, 83.91×8, 88.45×5 kg (+1 warm-up)');
});

test('legacy projection for a touched legacy entry and for cardio', () => {
  const [entry] = normalizeEntries([LEGACY_CORPUS[0]]);
  entry.touched = true;
  entry.sets[0].kg = 100;
  const [stored] = entriesToStored([entry]) as any[];
  assert.equal(stored.v, 2);
  assert.equal(stored.sets, 3);
  assert.equal(stored.reps, 10);
  const [run] = normalizeEntries([
    { v: 2, exercise: { name: 'Running', isCustom: false, type: 'distance_duration' }, log: [{ m: 4828.03, sec: 1500 }], sets: 1, reps: 1 },
  ]);
  assert.equal(formatExerciseEntry(run, 'lb'), '3 mi in 25:00');
  assert.deepEqual(legacyProjection(run), { sets: 1, reps: 1 });
});

test('exerciseKey normalizes case, whitespace and invisible characters', () => {
  assert.equal(exerciseKey('  Push-ups '), 'push-ups');
  assert.equal(exerciseKey('Bench​  Press'), 'bench press');
  assert.equal(exerciseKey('ＢＥＮＣＨ'), 'bench'); // NFKC folds full-width letters
});

// ---------------------------------------------------------------------------
// hostile input: the normalizer must never throw and must respect its caps
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomValue(rand: () => number, depth = 0): unknown {
  const pick = Math.floor(rand() * (depth > 2 ? 8 : 12));
  switch (pick) {
    case 0: return null;
    case 1: return undefined;
    case 2: return rand() < 0.5;
    case 3: return Math.floor(rand() * 2000) - 500;
    case 4: return rand() * 1e12;
    case 5: return [NaN, Infinity, -Infinity, 1e308][Math.floor(rand() * 4)];
    case 6: return ['', ' ', 'Squat', 'x'.repeat(500), '​', '12', 'NaN'][Math.floor(rand() * 7)];
    case 7: return {};
    case 8: return Array.from({ length: Math.floor(rand() * 5) }, () => randomValue(rand, depth + 1));
    case 9: return randomEntry(rand, depth + 1);
    default: {
      const obj: Record<string, unknown> = {};
      for (const key of ['exercise', 'name', 'sets', 'reps', 'log', 'kg', 'prs', 'type', 'v', 'kind']) {
        if (rand() < 0.4) obj[key] = randomValue(rand, depth + 1);
      }
      return obj;
    }
  }
}

function randomEntry(rand: () => number, depth: number): unknown {
  const log = Array.from({ length: Math.floor(rand() * 90) }, () => (rand() < 0.5 ? { kg: randomValue(rand, 9), reps: randomValue(rand, 9), kind: randomValue(rand, 9), sec: randomValue(rand, 9), m: randomValue(rand, 9) } : randomValue(rand, 9)));
  return {
    exercise: rand() < 0.8 ? { name: randomValue(rand, depth + 1), isCustom: randomValue(rand, depth + 1), type: randomValue(rand, depth + 1) } : randomValue(rand, depth + 1),
    ...(rand() < 0.6 ? { log } : { sets: randomValue(rand, depth + 1), reps: randomValue(rand, depth + 1) }),
    prs: randomValue(rand, depth + 1),
  };
}

test('fuzz: 10k random values never throw and always satisfy invariants', () => {
  const rand = mulberry32(20261004);
  for (let i = 0; i < 10_000; i += 1) {
    const raw = rand() < 0.3 ? randomValue(rand) : Array.from({ length: Math.floor(rand() * 80) }, () => randomEntry(rand, 0));
    const entries = normalizeEntries(raw);
    assert.ok(entries.length <= MAX_ENTRIES);
    for (const entry of entries) {
      assert.ok(entry.exercise.name.length > 0 && entry.exercise.name.length <= MAX_NAME_LENGTH);
      assert.ok(entry.sets.length <= MAX_SETS);
      assert.ok(['weight_reps', 'bodyweight_reps', 'duration', 'distance_duration'].includes(entry.exercise.type));
      assert.ok(entry.prs.length <= 3);
      for (const s of entry.sets) {
        for (const value of [s.kg, s.reps, s.sec, s.m, s.rpe]) {
          assert.ok(value === null || Number.isFinite(value));
        }
        assert.ok(s.kg === null || (s.kg > 0 && s.kg <= 1500));
        assert.ok(s.reps === null || (s.reps >= 1 && s.reps <= 999));
      }
      assert.doesNotThrow(() => formatExerciseEntry(entry, 'lb'));
      assert.doesNotThrow(() => formatExerciseEntry(entry, 'kg'));
    }
    assert.doesNotThrow(() => JSON.stringify(entriesToStored(entries)));
    // normalizing the writer's output is stable (idempotent)
    const again = normalizeEntries(JSON.parse(JSON.stringify(entriesToStored(entries))));
    assert.equal(again.length, entries.length);
  }
});

test('size caps are enforced', () => {
  const big = Array.from({ length: 200 }, (_, i) => ({ exercise: { name: `E${i}`, isCustom: false }, sets: 3, reps: 10 }));
  assert.equal(normalizeEntries(big).length, MAX_ENTRIES);
  const manySets = { v: 2, exercise: { name: 'X', isCustom: false }, log: Array.from({ length: 500 }, () => ({ kg: 50, reps: 5 })), sets: 1, reps: 1 };
  assert.equal(normalizeEntries([manySets])[0].sets.length, MAX_SETS);
  assert.equal(normalizeEntries([{ exercise: { name: 'n'.repeat(1000), isCustom: false }, sets: 1, reps: 1 }])[0].exercise.name.length, MAX_NAME_LENGTH);
  assert.deepEqual(normalizeEntries('not an array'), []);
  assert.deepEqual(normalizeEntries(null), []);
  assert.deepEqual(normalizeEntries({ 0: 'x' }), []);
});
