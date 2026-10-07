import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEntries } from './entry';
import { buildShareCard, clip, SHARE_CARD_MAX_LINES } from './shareCard';
import { lbToKg } from './units';

const lb = lbToKg;
const v2 = (name: string, log: object[], type = 'weight_reps', prs?: string[]) => ({
  v: 2,
  exercise: { name, isCustom: false, type },
  log,
  ...(prs ? { prs } : {}),
  sets: 1,
  reps: 1,
});
const build = (exercises: unknown[], over: Partial<Parameters<typeof buildShareCard>[0]> = {}) =>
  buildShareCard({
    workout: { date: '2026-10-06T12:00:00.000Z', dayType: { name: 'Push Day' }, exercises: normalizeEntries(exercises) },
    unit: 'lb',
    username: 'oski',
    bearStage: 3,
    ...over,
  });

test('clip cuts by code point and never splits an emoji', () => {
  assert.equal(clip('Bench', 10), 'Bench');
  assert.equal(clip('abcdefghij', 5), 'abcd…');
  const clipped = clip('💪'.repeat(10), 4);
  assert.equal(Array.from(clipped).length, 4);
  assert.ok(clipped.endsWith('…'));
  assert.equal(clip('  padded  ', 20), 'padded');
});

test('summarises a weighted exercise by its heaviest set and counts sets', () => {
  const model = build([v2('Bench Press', [{ kg: lb(135), reps: 8 }, { kg: lb(185), reps: 5 }, { kg: lb(155), reps: 6 }])]);
  assert.deepEqual(model.lines, [{ name: 'Bench Press', detail: '3 sets · top 185×5 lb', pr: false }]);
});

test('a single set reads as just that set; warm-ups are not the top set', () => {
  const single = build([v2('Squat', [{ kg: lb(225), reps: 3 }])]);
  assert.equal(single.lines[0].detail, '225×3 lb');
  const withWarmup = build([v2('Squat', [{ kg: lb(315), reps: 1, kind: 'warmup' }, { kg: lb(225), reps: 3 }])]);
  assert.equal(withWarmup.lines[0].detail, '225×3 lb');
  const warmupOnly = build([v2('Squat', [{ kg: lb(95), reps: 5, kind: 'warmup' }])]);
  assert.equal(warmupOnly.lines[0].detail, 'Warm-up only');
});

test('uses the viewer unit and converts weights', () => {
  const model = build([v2('Bench Press', [{ kg: 100, reps: 5 }])], { unit: 'kg' });
  assert.equal(model.lines[0].detail, '100×5 kg');
});

test('bodyweight, duration and distance exercises pick their own best set', () => {
  const model = build([
    v2('Pull-ups', [{ reps: 8 }, { reps: 12 }, { reps: 10 }], 'bodyweight_reps'),
    v2('Plank', [{ sec: 30 }, { sec: 95 }], 'duration'),
    v2('Running', [{ m: 1000, sec: 360 }, { m: 3000, sec: 1200 }], 'distance_duration'),
  ]);
  assert.equal(model.lines[0].detail, '3 sets · top 12');
  assert.equal(model.lines[1].detail, '2 sets · top 1:35');
  assert.match(model.lines[2].detail, /^2 sets · top /);
  assert.match(model.lines[2].detail, /20:00/);
});

test('legacy entries keep their original wording and add no volume', () => {
  const model = build([{ exercise: { name: 'Push-ups', isCustom: false }, sets: 3, reps: [10, 10, 8] }]);
  assert.equal(model.lines[0].detail, '3 sets × 10, 10, 8 reps');
  assert.ok(!model.stats.some((s) => s.label.startsWith('Volume')));
  assert.equal(model.stats.find((s) => s.label === 'Sets')?.value, '3');
});

test('caps the list, reports the rest, and flags PRs', () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    v2(`Exercise ${i}`, [{ kg: lb(100), reps: 5 }], 'weight_reps', i === 1 ? ['weight'] : undefined),
  );
  const model = build(many);
  assert.equal(model.lines.length, SHARE_CARD_MAX_LINES);
  assert.equal(model.moreCount, 3);
  assert.equal(model.lines[1].pr, true);
  assert.equal(model.prCount, 1);
  assert.equal(model.stats.find((s) => s.label === 'New PR')?.value, '1');
  assert.equal(model.stats.find((s) => s.label === 'Exercises')?.value, '8');
});

test('sums volume across working sets in the viewer unit, with separators', () => {
  const model = build([v2('Squat', [{ kg: lb(1000), reps: 10 }, { kg: lb(500), reps: 10, kind: 'warmup' }])]);
  const volume = model.stats.find((s) => s.label === 'Volume (lb)');
  assert.equal(volume?.value, '10,000');
});

test('title, date, handle and filename', () => {
  const model = build([v2('Bench', [{ kg: 60, reps: 5 }])], {
    workout: { date: '2026-10-06T12:00:00.000Z', dayType: { name: 'Push Day!! 💪' }, exercises: [] },
  });
  assert.equal(model.dateLabel, 'Tue, Oct 6');
  assert.equal(model.handle, '@oski');
  assert.equal(model.filename, 'oskilifts-2026-10-06-push-day.png');
  assert.equal(build([], { username: null }).handle, null);
});

test('hostile or empty input still yields a usable card', () => {
  const model = build([], {
    workout: { date: 'garbage', dayType: { name: '' }, exercises: normalizeEntries('nope') },
  });
  assert.equal(model.title, 'Workout');
  assert.equal(model.lines.length, 0);
  assert.equal(model.filename, 'oskilifts-workout.png');
});

test('long names are clipped', () => {
  const model = build([v2('A'.repeat(80), [{ kg: 50, reps: 5 }])]);
  assert.ok(Array.from(model.lines[0].name).length <= 28);
});
