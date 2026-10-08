const express = require('express');
const { verifyJobSecret } = require('./jobAuth');
const { runWeeklyDigest, runAdminAlert } = require('./emailJobs');
const { escapeHtml } = require('./digestEmail');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:440px;margin:15vh auto;padding:0 20px;color:#0f172a}h1{color:#003262;font-size:22px}button{background:#003262;color:#FDB515;border:0;border-radius:10px;padding:12px 20px;font-size:16px;font-weight:700;cursor:pointer}p{line-height:1.5;color:#334155}</style></head><body>${body}</body></html>`;
}

/**
 * Mounts the email job endpoints and the unsubscribe page.
 * `deps` is injected so tests can use fakes: { getSupabase, send, config, jobSecret }.
 */
function registerEmailRoutes(app, deps) {
  const { getSupabase, send, config } = deps;
  const secret = () => (typeof deps.jobSecret === 'function' ? deps.jobSecret() : deps.jobSecret);

  const authorize = (req, res) => {
    if (!verifyJobSecret(req.get('x-job-secret'), secret())) {
      res.status(401).json({ error: 'unauthorized' });
      return false;
    }
    return true;
  };

  const job = (name, run) => async (req, res) => {
    if (!authorize(req, res)) return;
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'database_not_configured' });
    try {
      const result = await run({ supabase, send, config });
      return res.json({ job: name, ...result });
    } catch (error) {
      console.error(`[email-jobs] ${name} failed:`, error);
      return res.status(500).json({ error: 'job_failed' });
    }
  };

  app.post('/api/jobs/weekly-digest', job('weekly-digest', runWeeklyDigest));
  app.post('/api/jobs/admin-alert', job('admin-alert', runAdminAlert));

  // A confirmation page, so mail scanners that open links can't unsubscribe anyone.
  app.get('/unsubscribe', (req, res) => {
    const token = String(req.query.t || '');
    res.setHeader('Cache-Control', 'no-store');
    if (!UUID.test(token)) {
      return res.status(400).send(page('Unsubscribe', '<h1>This link isn’t valid</h1><p>Open OSKILIFTS and turn the weekly recap off under Me.</p>'));
    }
    return res.send(
      page(
        'Unsubscribe',
        `<h1>Stop the weekly recap?</h1><p>You’ll no longer get the OSKILIFTS weekly email.</p>
<form method="post" action="/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`,
      ),
    );
  });

  // Used by the confirmation page and by mail apps' one-click unsubscribe (RFC 8058).
  app.post('/unsubscribe', express.urlencoded({ extended: false }), async (req, res) => {
    const token = String(req.query.t || '');
    res.setHeader('Cache-Control', 'no-store');
    if (!UUID.test(token)) return res.status(400).send(page('Unsubscribe', '<h1>This link isn’t valid</h1>'));
    const supabase = getSupabase();
    if (!supabase) return res.status(503).send(page('Unsubscribe', '<h1>Please try again later</h1>'));
    const { error } = await supabase.rpc('digest_unsubscribe', { p_token: token });
    if (error) return res.status(500).send(page('Unsubscribe', '<h1>Something went wrong</h1><p>Please try again, or turn the recap off in the app under Me.</p>'));
    // The same answer whether or not it was still on, so tokens can't be probed.
    return res.send(page('Unsubscribed', '<h1>You’re unsubscribed</h1><p>You won’t get the weekly recap any more. You can turn it back on in the app under Me.</p>'));
  });
}

module.exports = { registerEmailRoutes };
