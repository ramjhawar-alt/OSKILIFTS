import assert from 'node:assert/strict';
import test from 'node:test';

import { friendlyModerationError, reasonLabel, removeConfirmation, removeLabel, summarizeSnapshot } from './moderation';

test('reason labels, with a safe fallback', () => {
  assert.equal(reasonLabel('hate'), 'Hate speech');
  assert.equal(reasonLabel('something_new'), 'Something else');
});

test('only comments and workouts can be removed', () => {
  assert.equal(removeLabel('comment'), 'Delete comment');
  assert.equal(removeLabel('workout'), 'Hide workout');
  assert.equal(removeLabel('profile'), null);
  assert.match(removeConfirmation('comment'), /permanently deletes/);
  assert.match(removeConfirmation('workout'), /Only me/);
});

test('comment snapshots are quoted and clipped', () => {
  assert.deepEqual(summarizeSnapshot('comment', { body: 'rude\n\n  comment' }), ['“rude comment”']);
  const long = summarizeSnapshot('comment', { body: 'x'.repeat(1000) });
  assert.ok(Array.from(long[0]).length <= 304);
  assert.deepEqual(summarizeSnapshot('comment', {}), ['(no text saved)']);
});

test('workout snapshots show day, exercises and notes', () => {
  const lines = summarizeSnapshot('workout', {
    day_type: { name: 'Push Day' },
    exercises: [{ exercise: { name: 'Bench Press', isCustom: false }, sets: 3, reps: 5 }],
    notes: 'bad note',
  });
  assert.deepEqual(lines, ['Push Day', 'Bench Press', 'Notes: “bad note”']);
});

test('profile snapshots show names', () => {
  assert.deepEqual(summarizeSnapshot('profile', { username: 'bob', display_name: 'Bob' }), ['Bob', '@bob']);
});

test('hostile or malformed snapshots never throw', () => {
  const hostile: unknown[] = [null, undefined, 5, 'text', [], [[]], { exercises: 'x', day_type: 5, notes: {} }, { exercises: [null, 1, { exercise: 5 }] }, { body: { toString() { throw new Error('boom'); } } }];
  for (const snapshot of hostile) {
    for (const target of ['comment', 'workout', 'profile'] as const) {
      const lines = summarizeSnapshot(target, snapshot);
      assert.ok(Array.isArray(lines) && lines.length > 0 && lines.every((l) => typeof l === 'string'));
    }
  }
});

test('errors are readable', () => {
  assert.match(friendlyModerationError('not_admin'), /admins/);
  assert.match(friendlyModerationError('cannot_remove_profile'), /dashboard/);
  assert.equal(friendlyModerationError('x'), 'x');
});
