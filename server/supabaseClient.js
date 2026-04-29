const { createClient } = require('@supabase/supabase-js');

let singleton;

/**
 * Lazy singleton Supabase client (service role for server-side inserts).
 * Returns null if env vars are missing so local dev without DB still runs.
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  if (!singleton) {
    singleton = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return singleton;
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = {
  getSupabase,
  isSupabaseConfigured,
};
