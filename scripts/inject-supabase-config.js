// Runs after `expo export` (see "web:build"): fills the public Supabase config
// into dist/reset-password.html, since Expo copies public/ files verbatim.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'dist', 'reset-password.html');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!fs.existsSync(target)) {
  console.warn(`[inject-supabase-config] ${target} not found; skipping.`);
  process.exit(0);
}
if (!url || !anonKey) {
  console.warn(
    '[inject-supabase-config] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set; password reset page will show "Link expired" until they are.',
  );
  process.exit(0);
}

const html = fs
  .readFileSync(target, 'utf8')
  .replace('__SUPABASE_URL__', url)
  .replace('__SUPABASE_ANON_KEY__', anonKey);
fs.writeFileSync(target, html);
console.log('[inject-supabase-config] Injected Supabase config into reset-password.html');
