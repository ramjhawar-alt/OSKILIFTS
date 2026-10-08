const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends one email through the Resend HTTP API. Never throws: failures come back as
 * { ok: false, error } so a job can carry on with the next person.
 * `fetchImpl` is injectable for tests.
 */
function createEmailSender({ apiKey, fetchImpl = globalThis.fetch } = {}) {
  return async function sendEmail({ from, to, subject, html, text, replyTo, headers }) {
    if (!apiKey) return { ok: false, error: 'email_not_configured' };
    if (!from || !to || !subject || (!html && !text)) return { ok: false, error: 'invalid_email' };
    try {
      const response = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          ...(html ? { html } : {}),
          ...(text ? { text } : {}),
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(headers ? { headers } : {}),
        }),
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = (await response.text()).slice(0, 200);
        } catch {
          // ignore
        }
        return { ok: false, error: `resend_${response.status}`, detail };
      }
      const data = await response.json().catch(() => ({}));
      return { ok: true, id: data.id };
    } catch (error) {
      return { ok: false, error: 'network_error', detail: String(error && error.message).slice(0, 200) };
    }
  };
}

module.exports = { createEmailSender, RESEND_URL };
