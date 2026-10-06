// Verifies migration 006 grandfathers pre-existing oversized workouts (NOT VALID
// constraints) while rejecting new oversized writes. Run:
//   node server/tests/local/limits_backfill_check.mjs
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'migrations');
const db = new PGlite({ extensions: { pgcrypto } });
const sql = (f) => readFileSync(join(dir, f), 'utf8');

await db.exec(readFileSync(join(here, 'stub_auth.sql'), 'utf8'));
for (const f of ['002', '003', '004', '005'].map((p) => readdirSync(dir).find((n) => n.startsWith(p)))) {
  await db.exec(sql(f));
}
await db.exec(`insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000a', 'old@berkeley.edu');`);
// An oversized legacy row written before the limits existed.
await db.exec(`
  insert into public.workouts (user_id, date, day_type, exercises)
  select 'a0000000-0000-0000-0000-00000000000a', now(), '{}',
         (select jsonb_agg(jsonb_build_object('exercise', jsonb_build_object('name','x'), 'pad', repeat('x', 5000))) from generate_series(1, 80));
`);
await db.exec(sql('006_phase3_foundations.sql')); // must not fail on the old row
await db.exec(sql('006_phase3_foundations.sql')); // and must be re-runnable

let rejected = false;
try {
  await db.exec(`insert into public.workouts (user_id, date, day_type, exercises)
    values ('a0000000-0000-0000-0000-00000000000a', now(), '{}',
      (select jsonb_agg(jsonb_build_object('exercise', jsonb_build_object('name','x'))) from generate_series(1, 61)));`);
} catch {
  rejected = true;
}
const { rows } = await db.query('select count(*)::int n from public.workouts');
if (!rejected || rows[0].n !== 1) {
  console.error('FAIL: expected the old row kept and a new 61-entry workout rejected');
  process.exit(1);
}
console.log('ok: oversized pre-existing row grandfathered; new oversized writes rejected; 006 re-runnable');
