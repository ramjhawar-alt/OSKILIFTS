// Verifies migration 004 backfills pre-existing workouts to 'private' while new
// rows default to 'followers'. Run: node server/tests/local/backfill_check.mjs
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(join(here, '..', '..', 'migrations', f), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(readFileSync(join(here, 'stub_auth.sql'), 'utf8'));
await db.exec(mig('002_accounts_and_workouts.sql'));
await db.exec(mig('003_profiles_usernames.sql'));
await db.exec(`
  insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000a', 'old@berkeley.edu');
  insert into public.workouts (user_id, date, day_type, exercises)
    values ('a0000000-0000-0000-0000-00000000000a', now(), '{}', '[]');
`);
await db.exec(mig('004_follows_visibility_feed.sql'));
await db.exec(`
  insert into public.workouts (user_id, date, day_type, exercises)
    values ('a0000000-0000-0000-0000-00000000000a', now(), '{}', '[]');
`);
// Re-running must not flip anything back.
await db.exec(mig('004_follows_visibility_feed.sql'));

const { rows } = await db.query('select visibility, count(*)::int n from public.workouts group by 1 order by 1');
console.log(rows);
const byVis = Object.fromEntries(rows.map((r) => [r.visibility, r.n]));
if (byVis.private !== 1 || byVis.followers !== 1) {
  console.error('FAIL: expected 1 private (pre-existing) and 1 followers (new)');
  process.exit(1);
}
console.log('ok: existing workouts backfilled to private, new default is followers');
