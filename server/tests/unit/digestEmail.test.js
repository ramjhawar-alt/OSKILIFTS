const assert = require('node:assert/strict');
const test = require('node:test');
const { buildDigestEmail, buildAdminAlertEmail, escapeHtml } = require('../../digestEmail');

const base = { displayName: 'Alice', username: 'alice_lifts', unsubscribeUrl: 'https://api.test/unsubscribe?t=abc', appUrl: 'https://oskilifts.com' };

test('escapes HTML in everything a user controls', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
  const email = buildDigestEmail({ ...base, displayName: '<img src=x onerror=alert(1)>', payload: { new_followers: 1, follower_names: ['<b>evil</b>'] } });
  assert.ok(!email.html.includes('<img src=x'), 'display name is escaped');
  assert.ok(!email.html.includes('<b>evil</b>'), 'follower names are escaped');
  assert.ok(email.html.includes('&lt;b&gt;evil&lt;/b&gt;'));
});

test('only mentions things that happened, with correct plurals', () => {
  const one = buildDigestEmail({ ...base, payload: { new_followers: 1, follower_names: ['dave'], pending_requests: 0, likes: 1, comments: 0, days_trained: 0 } });
  assert.ok(one.text.includes('1 new follower (@dave)'));
  assert.ok(one.text.includes('1 like on your workouts'));
  assert.ok(!one.text.includes('comment'), 'no zero lines');
  assert.ok(!one.text.includes('follow request'));
  const many = buildDigestEmail({ ...base, payload: { new_followers: 5, follower_names: ['a', 'b', 'c'], pending_requests: 2, likes: 12, comments: 3, days_trained: 3, weekly_goal: 4 } });
  assert.ok(many.text.includes('5 new followers (@a, @b, @c and others)'));
  assert.ok(many.text.includes('2 follow requests are waiting for you'));
  assert.ok(many.text.includes('12 likes on your workouts'));
  assert.ok(many.text.includes('3 comments on your workouts'));
  assert.ok(many.text.includes('You trained 3 of 4 days this week'));
});

test('subject summarises the activity', () => {
  assert.equal(buildDigestEmail({ ...base, payload: { new_followers: 2, likes: 1, comments: 2 } }).subject, 'Your OSKILIFTS week: 2 new followers and 3 reactions');
  assert.equal(buildDigestEmail({ ...base, payload: { pending_requests: 1 } }).subject, 'Your OSKILIFTS week: 1 follow request');
});

test('always carries the unsubscribe link and a link back to the app', () => {
  const email = buildDigestEmail({ ...base, payload: { likes: 1 } });
  for (const part of [email.html, email.text]) {
    assert.ok(part.includes('https://api.test/unsubscribe?t=abc'));
    assert.ok(part.includes('https://oskilifts.com'));
  }
});

test('malformed counts are treated as zero', () => {
  const email = buildDigestEmail({ ...base, payload: { new_followers: -3, likes: 'lots', comments: null, pending_requests: NaN, follower_names: 'nope', days_trained: 2.9 } });
  assert.ok(!email.text.includes('follower'));
  assert.ok(!email.text.includes('like'));
  assert.ok(email.text.includes('You trained 2 days this week'));
  assert.doesNotThrow(() => buildDigestEmail({ ...base, payload: null }));
});

test('admin alert reports the count and the age', () => {
  const now = new Date('2026-10-07T20:00:00Z');
  const hours = buildAdminAlertEmail({ openCount: 1, oldestOpen: '2026-10-07T17:00:00Z', appUrl: 'https://oskilifts.com', now });
  assert.equal(hours.subject, '1 report waiting for review on OSKILIFTS');
  assert.ok(hours.text.includes('about 3 hours'));
  const days = buildAdminAlertEmail({ openCount: 4, oldestOpen: '2026-10-03T20:00:00Z', appUrl: 'https://oskilifts.com', now });
  assert.equal(days.subject, '4 reports waiting for review on OSKILIFTS');
  assert.ok(days.text.includes('4 days'));
  assert.ok(!hours.html.includes('undefined') && !days.html.includes('NaN'));
});
