const { buildDigestEmail, buildAdminAlertEmail } = require('./digestEmail');

// Two overlapping runs (a retried request, say) must not email people twice.
const running = new Set();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function guarded(name, fn) {
  if (running.has(name)) return { skipped: 'already_running' };
  running.add(name);
  try {
    return await fn();
  } finally {
    running.delete(name);
  }
}

/**
 * Sends the weekly recap to everyone who is due one. A person is marked as sent only
 * after their email was accepted, so a failure is simply retried at the next run.
 */
function runWeeklyDigest({ supabase, send, config, limit = 80, pauseMs = 250 }) {
  return guarded('weekly-digest', async () => {
    const { data, error } = await supabase.rpc('digest_candidates', { p_limit: limit });
    if (error) return { error: 'candidates_failed', detail: error.message };
    const people = data || [];
    const result = { candidates: people.length, sent: 0, failed: 0 };
    for (const person of people) {
      const unsubscribeUrl = `${config.apiUrl}/unsubscribe?t=${encodeURIComponent(person.unsubscribe_token)}`;
      const email = buildDigestEmail({
        displayName: person.display_name,
        username: person.username,
        payload: person.payload,
        unsubscribeUrl,
        appUrl: config.appUrl,
      });
      const outcome = await send({
        from: config.fromDigest,
        to: person.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: config.replyTo,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (outcome.ok) {
        const { error: markError } = await supabase.rpc('digest_mark_sent', { p_user: person.user_id });
        if (markError) result.failed += 1; // sent but not recorded: logged, and the 6-day rule limits repeats
        else result.sent += 1;
      } else {
        result.failed += 1;
      }
      if (pauseMs) await wait(pauseMs);
    }
    return result;
  });
}

/** Tells each admin (at most daily) that reports are waiting. */
function runAdminAlert({ supabase, send, config }) {
  return guarded('admin-alert', async () => {
    const { data, error } = await supabase.rpc('admin_alert_candidates');
    if (error) return { error: 'candidates_failed', detail: error.message };
    const admins = data || [];
    const result = { candidates: admins.length, sent: 0, failed: 0 };
    for (const admin of admins) {
      const email = buildAdminAlertEmail({
        openCount: admin.open_count,
        oldestOpen: admin.oldest_open,
        appUrl: config.appUrl,
      });
      const outcome = await send({
        from: config.fromAlerts,
        to: admin.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (outcome.ok) result.sent += 1;
      else result.failed += 1;
    }
    if (result.sent > 0) {
      const { error: markError } = await supabase.rpc('admin_alert_mark_sent');
      if (markError) result.markFailed = true;
    }
    return result;
  });
}

module.exports = { runWeeklyDigest, runAdminAlert };
