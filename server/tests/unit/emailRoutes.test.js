const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { registerEmailRoutes } = require('../../emailRoutes');

const SECRET = 's'.repeat(32);
const TOKEN = '11111111-2222-4333-8444-555555555555';

async function withServer(overrides, fn) {
  const rpcCalls = [];
  const db = overrides.db === undefined
    ? { rpc: async (name, args) => { rpcCalls.push([name, args]); return { data: name.endsWith('_candidates') ? [] : true, error: overrides.rpcError || null }; } }
    : overrides.db;
  const app = express();
  registerEmailRoutes(app, {
    getSupabase: () => db,
    send: async () => ({ ok: true }),
    jobSecret: () => (overrides.secret === undefined ? SECRET : overrides.secret),
    config: { apiUrl: 'https://api.test', appUrl: 'https://oskilifts.com', fromDigest: 'a', fromAlerts: 'b', replyTo: 'c' },
  });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, rpcCalls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('job endpoints refuse requests without the right secret', async () => {
  await withServer({}, async (base, calls) => {
    for (const path of ['/api/jobs/weekly-digest', '/api/jobs/admin-alert']) {
      assert.equal((await fetch(base + path, { method: 'POST' })).status, 401);
      assert.equal((await fetch(base + path, { method: 'POST', headers: { 'x-job-secret': 'wrong' } })).status, 401);
      assert.equal((await fetch(base + path, { method: 'GET', headers: { 'x-job-secret': SECRET } })).status, 404, 'GET is not a job');
    }
    assert.equal(calls.length, 0, 'nothing touched the database');
  });
});

test('with the secret the jobs run', async () => {
  await withServer({}, async (base, calls) => {
    const response = await fetch(base + '/api/jobs/weekly-digest', { method: 'POST', headers: { 'x-job-secret': SECRET } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { job: 'weekly-digest', candidates: 0, sent: 0, failed: 0 });
    assert.equal(calls[0][0], 'digest_candidates');
    const alert = await fetch(base + '/api/jobs/admin-alert', { method: 'POST', headers: { 'x-job-secret': SECRET } });
    assert.equal((await alert.json()).job, 'admin-alert');
  });
});

test('jobs are disabled when the server has no secret or no database', async () => {
  await withServer({ secret: '' }, async (base) => {
    assert.equal((await fetch(base + '/api/jobs/weekly-digest', { method: 'POST', headers: { 'x-job-secret': '' } })).status, 401);
  });
  await withServer({ secret: 'short' }, async (base) => {
    assert.equal((await fetch(base + '/api/jobs/weekly-digest', { method: 'POST', headers: { 'x-job-secret': 'short' } })).status, 401, 'a short secret never opens the endpoint');
  });
  await withServer({ db: null }, async (base) => {
    assert.equal((await fetch(base + '/api/jobs/weekly-digest', { method: 'POST', headers: { 'x-job-secret': SECRET } })).status, 503);
  });
});

test('a crashing job returns a generic error, not internals', async () => {
  const exploding = { rpc: async () => { throw new Error('database password is hunter2'); } };
  await withServer({ db: exploding }, async (base) => {
    const response = await fetch(base + '/api/jobs/weekly-digest', { method: 'POST', headers: { 'x-job-secret': SECRET } });
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.ok(!text.includes('hunter2'));
  });
});

test('the unsubscribe link shows a confirmation page and changes nothing by itself', async () => {
  await withServer({}, async (base, calls) => {
    const response = await fetch(`${base}/unsubscribe?t=${TOKEN}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('Stop the weekly recap?'));
    assert.ok(html.includes(`action="/unsubscribe?t=${TOKEN}"`));
    assert.equal(calls.length, 0, 'a mail scanner that opens the link cannot unsubscribe anyone');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('confirming (or a one-click POST from a mail app) unsubscribes via the token', async () => {
  await withServer({}, async (base, calls) => {
    const form = await fetch(`${base}/unsubscribe?t=${TOKEN}`, { method: 'POST' });
    assert.equal(form.status, 200);
    assert.ok((await form.text()).includes('You’re unsubscribed'));
    const oneClick = await fetch(`${base}/unsubscribe?t=${TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    });
    assert.equal(oneClick.status, 200);
    assert.deepEqual(calls, [['digest_unsubscribe', { p_token: TOKEN }], ['digest_unsubscribe', { p_token: TOKEN }]]);
  });
});

test('invalid tokens are refused before touching the database', async () => {
  await withServer({}, async (base, calls) => {
    for (const bad of ['', 'abc', "'; drop table x; --", `${TOKEN}x`, '<script>']) {
      assert.equal((await fetch(`${base}/unsubscribe?t=${encodeURIComponent(bad)}`)).status, 400);
      assert.equal((await fetch(`${base}/unsubscribe?t=${encodeURIComponent(bad)}`, { method: 'POST' })).status, 400);
    }
    assert.equal((await fetch(`${base}/unsubscribe`, { method: 'POST' })).status, 400);
    assert.equal(calls.length, 0);
  });
});

test('a database failure on unsubscribe is reported, not hidden', async () => {
  await withServer({ rpcError: { message: 'down' } }, async (base) => {
    assert.equal((await fetch(`${base}/unsubscribe?t=${TOKEN}`, { method: 'POST' })).status, 500);
  });
  await withServer({ db: null }, async (base) => {
    assert.equal((await fetch(`${base}/unsubscribe?t=${TOKEN}`, { method: 'POST' })).status, 503);
  });
});
