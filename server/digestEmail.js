// Pure builders for the two emails. No I/O, so they are easy to test.
// Everything that came from a user (display names, usernames) is HTML-escaped.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function shell(title, bodyHtml, footerHtml) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 16px;color:#003262">${title}</h2>
  ${bodyHtml}
  <p style="margin:28px 0 0;font-size:12px;color:#64748b;line-height:1.5">${footerHtml}</p>
</div>`;
}

/**
 * The weekly recap. Lines are only included when there is something to say.
 * `payload` comes from the database function digest_candidates.
 */
function buildDigestEmail({ displayName, username, payload, unsubscribeUrl, appUrl }) {
  const followers = toCount(payload && payload.new_followers);
  const pending = toCount(payload && payload.pending_requests);
  const likes = toCount(payload && payload.likes);
  const comments = toCount(payload && payload.comments);
  const days = toCount(payload && payload.days_trained);
  const goal = toCount(payload && payload.weekly_goal);
  const names = Array.isArray(payload && payload.follower_names)
    ? payload.follower_names.filter((n) => typeof n === 'string').slice(0, 3)
    : [];

  const lines = [];
  if (followers > 0) {
    const who = names.length > 0 ? ` (${names.map((n) => `@${n}`).join(', ')}${followers > names.length ? ' and others' : ''})` : '';
    lines.push(`${plural(followers, 'new follower', 'new followers')}${who}`);
  }
  if (pending > 0) lines.push(`${plural(pending, 'follow request is', 'follow requests are')} waiting for you`);
  if (likes > 0) lines.push(`${plural(likes, 'like', 'likes')} on your workouts`);
  if (comments > 0) lines.push(`${plural(comments, 'comment', 'comments')} on your workouts`);
  if (days > 0) {
    lines.push(goal > 0 ? `You trained ${days} of ${goal} days this week` : `You trained ${plural(days, 'day', 'days')} this week`);
  }

  const greeting = `Hi ${displayName || username || 'there'},`;
  const subjectBits = [];
  if (followers > 0) subjectBits.push(plural(followers, 'new follower', 'new followers'));
  if (likes + comments > 0) subjectBits.push(plural(likes + comments, 'reaction', 'reactions'));
  if (pending > 0 && subjectBits.length === 0) subjectBits.push(plural(pending, 'follow request', 'follow requests'));
  const subject = `Your OSKILIFTS week: ${subjectBits.join(' and ') || 'a quick recap'}`;

  const items = lines.map((line) => `<li style="margin:0 0 8px">${escapeHtml(line)}</li>`).join('');
  const html = shell(
    'Your week on OSKILIFTS',
    `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(greeting)} here’s what happened:</p>
  <ul style="margin:0 0 24px;padding-left:20px;line-height:1.5">${items}</ul>
  <p style="margin:0"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#003262;color:#FDB515;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open OSKILIFTS</a></p>`,
    `You’re getting this weekly recap because you turned it on. You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b">unsubscribe</a> any time, or change it in the app under Me.`,
  );
  const text = `${greeting} here’s what happened this week on OSKILIFTS:\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\nOpen the app: ${appUrl}\n\nYou’re getting this because you turned on the weekly recap. Unsubscribe: ${unsubscribeUrl}\n`;
  return { subject, html, text, lineCount: lines.length };
}

/** The daily nudge for admins: how many reports are waiting, and how old the oldest is. */
function buildAdminAlertEmail({ openCount, oldestOpen, appUrl, now = new Date() }) {
  const count = toCount(openCount);
  const hours = oldestOpen ? Math.max(0, Math.floor((now.getTime() - new Date(oldestOpen).getTime()) / 3_600_000)) : 0;
  const age = hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} hour${hours === 1 ? '' : 's'}`;
  const subject = `${plural(count, 'report', 'reports')} waiting for review on OSKILIFTS`;
  const html = shell(
    'Reports waiting for review',
    `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(plural(count, 'report is', 'reports are'))} open. The oldest has been waiting about ${escapeHtml(age)}. Your terms promise a review within 24 hours.</p>
  <p style="margin:0"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#003262;color:#FDB515;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open OSKILIFTS</a></p>
  <p style="margin:16px 0 0;font-size:13px;color:#475569">In the app: Me, then Moderation.</p>`,
    'You get this at most once a day, and only while reports are open. You are receiving it because you are an OSKILIFTS admin.',
  );
  const text = `${plural(count, 'report is', 'reports are')} waiting for review on OSKILIFTS. The oldest has been waiting about ${age}.\n\nIn the app: Me, then Moderation. ${appUrl}\n`;
  return { subject, html, text };
}

module.exports = { buildDigestEmail, buildAdminAlertEmail, escapeHtml };
