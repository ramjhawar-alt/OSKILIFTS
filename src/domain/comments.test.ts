import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commentCountLabel,
  formatCommentTime,
  mergeComments,
  friendlyCommentError,
  MAX_COMMENT_LENGTH,
  remainingCharacters,
  validateCommentDraft,
} from './comments';

test('trims and accepts a normal comment', () => {
  assert.deepEqual(validateCommentDraft('  Nice lift!\n'), { ok: true, body: 'Nice lift!' });
});

test('rejects empty, whitespace-only and invisible-only drafts', () => {
  for (const text of ['', '   ', '\n\t ', '​​', ' ﻿ ']) {
    assert.deepEqual(validateCommentDraft(text), { ok: false, reason: 'empty' }, JSON.stringify(text));
  }
});

test('counts characters by code point, like the server', () => {
  assert.equal(validateCommentDraft('a'.repeat(MAX_COMMENT_LENGTH)).ok, true);
  assert.deepEqual(validateCommentDraft('a'.repeat(MAX_COMMENT_LENGTH + 1)), { ok: false, reason: 'too_long' });
  // 500 emoji are 500 characters, not 1000 UTF-16 units.
  assert.equal(validateCommentDraft('💪'.repeat(MAX_COMMENT_LENGTH)).ok, true);
  assert.equal(validateCommentDraft('💪'.repeat(MAX_COMMENT_LENGTH + 1)).ok, false);
});

test('keeps inner newlines and invisible characters between words', () => {
  const result = validateCommentDraft('line one\n\nline two');
  assert.deepEqual(result, { ok: true, body: 'line one\n\nline two' });
});

test('the remaining-characters counter only appears near the limit', () => {
  assert.equal(remainingCharacters('short'), null);
  assert.equal(remainingCharacters('a'.repeat(399)), null);
  assert.equal(remainingCharacters('a'.repeat(400)), 100);
  assert.equal(remainingCharacters('a'.repeat(512)), -12);
});

test('server errors become readable messages', () => {
  assert.match(friendlyCommentError('comment_not_allowed'), /respectful/);
  assert.match(friendlyCommentError('some wrapper: comment_rate_limited'), /too quickly/);
  assert.match(friendlyCommentError('too_many_comments_on_workout'), /limit/);
  assert.match(friendlyCommentError('comment_target_not_found'), /no longer available/);
  assert.match(friendlyCommentError('comment_not_found'), /already gone/);
  assert.equal(friendlyCommentError('network down'), 'network down');
});

test('count labels', () => {
  assert.equal(commentCountLabel(0), null);
  assert.equal(commentCountLabel(-3), null);
  assert.equal(commentCountLabel(NaN), null);
  assert.equal(commentCountLabel(1), '1 comment');
  assert.equal(commentCountLabel(12), '12 comments');
});

test('comment times are compact and tolerate clock skew', () => {
  const now = new Date('2026-10-06T20:00:00Z');
  assert.equal(formatCommentTime('2026-10-06T19:59:30Z', now), 'just now');
  assert.equal(formatCommentTime('2026-10-06T20:00:20Z', now), 'just now'); // slightly in the future
  assert.equal(formatCommentTime('2026-10-06T19:55:00Z', now), '5m');
  assert.equal(formatCommentTime('2026-10-06T17:00:00Z', now), '3h');
  assert.equal(formatCommentTime('2026-10-04T20:00:00Z', now), '2d');
  assert.match(formatCommentTime('2026-09-01T20:00:00Z', now), /^Sep 1$/);
  assert.equal(formatCommentTime('not a date', now), '');
});

test('merging keeps comments oldest-first, drops duplicates, and slots late pages in order', () => {
  const c = (id: string, createdAt: string, body = id) => ({ id, createdAt, body });
  const page1 = [c('a', '2026-10-06T12:00:00.1+00:00'), c('b', '2026-10-06T12:00:01+00:00')];
  const mine = c('z', '2026-10-06T12:30:00+00:00'); // posted while page 2 was unloaded
  const page2 = [c('c', '2026-10-06T12:10:00+00:00'), c('d', '2026-10-06T12:20:00+00:00')];
  const merged = mergeComments(mergeComments(page1, [mine]), page2);
  assert.deepEqual(merged.map((x) => x.id), ['a', 'b', 'c', 'd', 'z']);
  // Re-fetching the same page changes nothing.
  assert.deepEqual(mergeComments(merged, page2).map((x) => x.id), ['a', 'b', 'c', 'd', 'z']);
  // Same instant: order by raw time string, then id, deterministically.
  const ties = mergeComments([c('y', '2026-10-06T12:00:00+00:00')], [c('x', '2026-10-06T12:00:00+00:00')]);
  assert.deepEqual(ties.map((x) => x.id), ['x', 'y']);
  // A later copy of the same id wins.
  assert.equal(mergeComments([c('a', '2026-10-06T12:00:00+00:00', 'old')], [c('a', '2026-10-06T12:00:00+00:00', 'new')])[0].body, 'new');
});
