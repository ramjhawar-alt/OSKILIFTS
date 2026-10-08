import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PENDING_INVITE_MAX_AGE_MS,
  inviteLabel,
  inviteMessage,
  inviteUrl,
  parseInviteUrl,
  validatePendingInvite,
} from './invite';

test('builds the link, the label and the message', () => {
  assert.equal(inviteUrl('ram_lifts'), 'https://oskilifts.com/u/ram_lifts');
  assert.equal(inviteLabel('ram_lifts'), 'oskilifts.com/u/ram_lifts');
  assert.ok(inviteMessage('ram_lifts').endsWith('https://oskilifts.com/u/ram_lifts'));
});

test('reads invites from every link shape we hand out', () => {
  for (const url of [
    'https://oskilifts.com/u/ram_lifts',
    'https://www.oskilifts.com/u/ram_lifts/',
    'https://oskilifts.com/u/ram_lifts?utm_source=ig&ref=x',
    'https://oskilifts.com/u/RAM_Lifts#top',
    'http://localhost:8081/u/ram_lifts',
    'https://oskilifts-git-feature-x.vercel.app/u/ram_lifts',
    'oskilifts://u/ram_lifts',
    'exp://127.0.0.1:8083/--/u/ram_lifts',
  ]) {
    assert.equal(parseInviteUrl(url), 'ram_lifts', url);
  }
});

test('anything that is not exactly an invite is ignored', () => {
  for (const url of [
    '', 'not a url', 'https://oskilifts.com/', 'https://oskilifts.com/u', 'https://oskilifts.com/u/',
    'https://oskilifts.com/profile/ram_lifts', 'https://oskilifts.com/u/ram_lifts/extra',
    'https://oskilifts.com/x/u/ram_lifts', 'https://oskilifts.com/u/ab', 'https://oskilifts.com/u/' + 'a'.repeat(21),
    'https://oskilifts.com/u/ram-lifts', 'https://oskilifts.com/u/ram%20lifts', 'https://oskilifts.com/u/%E0%A4%A',
    'https://oskilifts.com/u/<script>', "https://oskilifts.com/u/ram_lifts';drop table x;--",
    'javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///u/ram_lifts', 'ftp://oskilifts.com/u/ram_lifts',
    'oskilifts://x/ram_lifts', 'oskilifts://u/ram_lifts/more', 'exp://127.0.0.1:8083/u/ram_lifts',
    'https://oskilifts.com/u/..%2F..%2Fadmin',
    'exp://127.0.0.1:8083/zzz/u/ram_lifts',
    'exp://127.0.0.1:8083/--/zzz/u/ram_lifts',
    'https://oskilifts.com/u/ram_lifts?' + 'x'.repeat(600),
  ]) {
    assert.equal(parseInviteUrl(url), null, url);
  }
  for (const bad of [null, undefined, 5, {}, [], 'https://oskilifts.com/u/' + 'a'.repeat(600)]) {
    assert.equal(parseInviteUrl(bad as any), null);
  }
});

test('pending invites expire and must be well formed', () => {
  const now = 1_800_000_000_000;
  assert.deepEqual(validatePendingInvite({ username: 'ram_lifts', savedAt: now - 1000 }, now), { username: 'ram_lifts', savedAt: now - 1000 });
  assert.equal(validatePendingInvite({ username: 'ram_lifts', savedAt: now - PENDING_INVITE_MAX_AGE_MS - 1 }, now), null, 'too old');
  assert.equal(validatePendingInvite({ username: 'ram_lifts', savedAt: now + 3_600_000 }, now), null, 'from the future');
  for (const bad of [null, undefined, 'x', 5, [], {}, { username: 'x', savedAt: now }, { username: 'ram_lifts' }, { username: 'ram_lifts', savedAt: 'now' }, { username: 'ram_lifts', savedAt: NaN }, { username: 5, savedAt: now }]) {
    assert.equal(validatePendingInvite(bad, now), null, JSON.stringify(bad));
  }
});
