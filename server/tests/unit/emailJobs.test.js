const assert = require('node:assert/strict');
const test = require('node:test');
const { runWeeklyDigest, runAdminAlert } = require('../../emailJobs');

const config = { apiUrl: 'https://api.test', appUrl: 'https://oskilifts.com', fromDigest: 'D <d@x>', fromAlerts: 'A <a@x>', replyTo: 'support@x' };
const person = (n, extra = {}) => ({
  user_id: `u${n}`, email: `u${n}@berkeley.edu`, username: `user${n}`, display_name: `User ${n}`,
  unsubscribe_token: `00000000-0000-4000-8000-00000000000${n}`, payload: { new_followers: 1, follower_names: ['x'], likes: 2 }, ...extra,
});
const fakeDb = (candidates, { markError = null, listError = null } = {}) => {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'digest_candidates' || name === 'admin_alert_candidates') return listError ? { data: null, error: listError } : { data: candidates, error: null };
      return { data: null, error: markError };
    },
  };
};
const okSend = () => { const sent = []; const fn = async (mail) => { sent.push(mail); return { ok: true }; }; fn.sent = sent; return fn; };

test('emails each person once, with unsubscribe headers, then marks them sent', async () => {
  const db = fakeDb([person(1), person(2)]);
  const send = okSend();
  const result = await runWeeklyDigest({ supabase: db, send, config, limit: 10, pauseMs: 0 });
  assert.deepEqual(result, { candidates: 2, sent: 2, failed: 0 });
  assert.deepEqual(send.sent.map((m) => m.to), ['u1@berkeley.edu', 'u2@berkeley.edu']);
  assert.equal(send.sent[0].from, 'D <d@x>');
  assert.equal(send.sent[0].replyTo, 'support@x');
  assert.equal(send.sent[0].headers['List-Unsubscribe'], '<https://api.test/unsubscribe?t=00000000-0000-4000-8000-000000000001>');
  assert.equal(send.sent[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.deepEqual(db.calls.filter(([n]) => n === 'digest_mark_sent').map(([, a]) => a.p_user), ['u1', 'u2']);
  assert.deepEqual(db.calls[0], ['digest_candidates', { p_limit: 10 }]);
});

test('a failed send is not marked, so the next run retries it, and others still go out', async () => {
  const db = fakeDb([person(1), person(2), person(3)]);
  const send = async (mail) => (mail.to === 'u2@berkeley.edu' ? { ok: false, error: 'resend_500' } : { ok: true });
  const result = await runWeeklyDigest({ supabase: db, send, config, pauseMs: 0 });
  assert.deepEqual(result, { candidates: 3, sent: 2, failed: 1 });
  assert.deepEqual(db.calls.filter(([n]) => n === 'digest_mark_sent').map(([, a]) => a.p_user), ['u1', 'u3']);
});

test('when marking fails the person is counted as failed (not silently sent)', async () => {
  const result = await runWeeklyDigest({ supabase: fakeDb([person(1)], { markError: { message: 'x' } }), send: okSend(), config, pauseMs: 0 });
  assert.deepEqual(result, { candidates: 1, sent: 0, failed: 1 });
});

test('a database error sends nothing', async () => {
  const send = okSend();
  const result = await runWeeklyDigest({ supabase: fakeDb(null, { listError: { message: 'boom' } }), send, config, pauseMs: 0 });
  assert.equal(result.error, 'candidates_failed');
  assert.equal(send.sent.length, 0);
});

test('nobody due means no emails', async () => {
  const send = okSend();
  assert.deepEqual(await runWeeklyDigest({ supabase: fakeDb([]), send, config, pauseMs: 0 }), { candidates: 0, sent: 0, failed: 0 });
  assert.equal(send.sent.length, 0);
});

test('the email contains counts only, never raw payload fields', async () => {
  const send = okSend();
  await runWeeklyDigest({ supabase: fakeDb([person(1, { payload: { new_followers: 1, likes: 1, secret_field: 'LEAK' } })]), send, config, pauseMs: 0 });
  assert.ok(!send.sent[0].html.includes('LEAK') && !send.sent[0].text.includes('LEAK'));
});

test('two overlapping runs cannot email people twice', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const sentA = okSend();
  const sentB = okSend();
  const slowDb = { rpc: async (name) => { await gate; return { data: name === 'digest_candidates' ? [person(1)] : null, error: null }; } };
  const first = runWeeklyDigest({ supabase: slowDb, send: sentA, config, pauseMs: 0 });
  const second = runWeeklyDigest({ supabase: slowDb, send: sentB, config, pauseMs: 0 }); // starts while the first is still running
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.sent, 1);
  assert.deepEqual(b, { skipped: 'already_running' });
  assert.equal(sentA.sent.length + sentB.sent.length, 1, 'exactly one email went out');
  // once finished, a new run is allowed again
  assert.equal((await runWeeklyDigest({ supabase: fakeDb([]), send: okSend(), config, pauseMs: 0 })).candidates, 0);
});

test('admin alert emails each admin and marks sent only if something went out', async () => {
  const db = fakeDb([{ email: 'ram_jhawar@berkeley.edu', open_count: 2, oldest_open: new Date(Date.now() - 5 * 3600_000).toISOString() }]);
  const send = okSend();
  const result = await runAdminAlert({ supabase: db, send, config });
  assert.deepEqual(result, { candidates: 1, sent: 1, failed: 0 });
  assert.equal(send.sent[0].to, 'ram_jhawar@berkeley.edu');
  assert.equal(send.sent[0].from, 'A <a@x>');
  assert.ok(send.sent[0].subject.startsWith('2 reports'));
  assert.ok(db.calls.some(([n]) => n === 'admin_alert_mark_sent'));

  const failing = fakeDb([{ email: 'a@berkeley.edu', open_count: 1, oldest_open: new Date().toISOString() }]);
  const bad = await runAdminAlert({ supabase: failing, send: async () => ({ ok: false, error: 'x' }), config });
  assert.deepEqual(bad, { candidates: 1, sent: 0, failed: 1 });
  assert.ok(!failing.calls.some(([n]) => n === 'admin_alert_mark_sent'), 'a failed alert is retried, not marked');
});
