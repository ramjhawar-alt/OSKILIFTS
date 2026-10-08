const assert = require('node:assert/strict');
const test = require('node:test');
const { createEmailSender, RESEND_URL } = require('../../emailService');

const mail = { from: 'A <a@oskilifts.com>', to: 'b@berkeley.edu', subject: 'Hi', html: '<p>x</p>', text: 'x' };

test('posts the right request to Resend', async () => {
  let seen;
  const send = createEmailSender({
    apiKey: 'key123',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, json: async () => ({ id: 'abc' }) };
    },
  });
  const result = await send({ ...mail, replyTo: 'support@x.com', headers: { 'List-Unsubscribe': '<https://u>' } });
  assert.deepEqual(result, { ok: true, id: 'abc' });
  assert.equal(seen.url, RESEND_URL);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers.Authorization, 'Bearer key123');
  const body = JSON.parse(seen.init.body);
  assert.deepEqual(body.to, ['b@berkeley.edu']);
  assert.equal(body.reply_to, 'support@x.com');
  assert.equal(body.headers['List-Unsubscribe'], '<https://u>');
  assert.equal(body.subject, 'Hi');
});

test('no API key means nothing is sent and nothing throws', async () => {
  let called = false;
  const send = createEmailSender({ fetchImpl: async () => { called = true; } });
  assert.deepEqual(await send(mail), { ok: false, error: 'email_not_configured' });
  assert.equal(called, false);
});

test('incomplete emails are refused before any network call', async () => {
  let called = false;
  const send = createEmailSender({ apiKey: 'k', fetchImpl: async () => { called = true; } });
  for (const bad of [{ ...mail, to: '' }, { ...mail, subject: '' }, { ...mail, from: undefined }, { ...mail, html: undefined, text: undefined }]) {
    assert.equal((await send(bad)).error, 'invalid_email');
  }
  assert.equal(called, false);
});

test('API errors and network errors come back as results, not exceptions', async () => {
  const rejected = createEmailSender({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 422, text: async () => 'bad domain' }) });
  assert.deepEqual(await rejected(mail), { ok: false, error: 'resend_422', detail: 'bad domain' });
  const down = createEmailSender({ apiKey: 'k', fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  const result = await down(mail);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'network_error');
});
