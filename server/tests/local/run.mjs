// Runs the SQL migrations and SQL tests against an in-process Postgres (PGlite).
//   node server/tests/local/run.mjs            -> migrations + every server/tests/*.sql
//   node server/tests/local/run.mjs --no-tests -> migrations only
// Migrations are always applied twice to prove they are idempotent (the
// Supabase SQL editor makes accidental re-runs easy).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'migrations');
const testsDir = join(here, '..');
const runTests = !process.argv.includes('--no-tests');

const db = new PGlite({ extensions: { pgcrypto } });

async function applyFile(label, path) {
  try {
    await db.exec(readFileSync(path, 'utf8'));
    console.log(`ok   ${label}`);
  } catch (error) {
    console.error(`FAIL ${label}\n     ${error.message}`);
    process.exit(1);
  }
}

await applyFile('stub auth schema', join(here, 'stub_auth.sql'));

// 001 only creates the server-side capacity_snapshots table; it has no auth
// dependency, so apply it too (the security audit checks that table as well).
const migrations = readdirSync(migrationsDir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort();
for (const file of migrations) {
  await applyFile(`migration ${file}`, join(migrationsDir, file));
  await applyFile(`migration ${file} (re-run)`, join(migrationsDir, file));
}

if (runTests) {
  // `--only=<file>` runs a single test file (used to check one test in isolation).
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
  const tests = readdirSync(testsDir)
    .filter((f) => f.endsWith('.sql') && (!only || f === only))
    .sort();
  for (const file of tests) {
    await applyFile(`test ${file}`, join(testsDir, file));
  }
}
console.log('all good');
