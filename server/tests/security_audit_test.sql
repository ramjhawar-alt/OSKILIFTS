-- Security audit: checks the WHOLE database against the rules every migration is
-- supposed to follow, so a future migration that forgets one fails loudly.
-- Read-only (it creates nothing). Safe to run in the Supabase SQL editor against
-- the real database, and runs in the local test suite too.
--
--   1. every table in `public` has row-level security enabled
--   2. the signed-out role (anon) has no privileges on any table, sequence, function
--      or on the `private` schema
--   3. tables that must have NO direct access for signed-in users really have none
--   4. every SECURITY DEFINER function pins its search_path (a classic privilege-escalation hole)
--   5. trigger functions cannot be called by app users
--   6. every table exposed to signed-in users is covered by an explicit RLS policy
--      (tables with RLS on and no policies are closed to everyone, which is fine)
-- Success = it finishes with no error. A failure names every offender.
begin;

do $$
declare
  -- No exemptions: even the server-side-only table (capacity_snapshots) must have RLS on and
  -- no API access (migration 016).
  rls_exempt text[] := array[]::text[];
  offenders text;
begin
  -- 1. RLS on every public table
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not c.relrowsecurity and c.relname <> all (rls_exempt);
  if offenders is not null then
    raise exception 'AUDIT 1: tables without row-level security: %', offenders;
  end if;

  -- 2a. anon has no table privileges
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm')
    and c.relname <> all (rls_exempt)
    and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger');
  if offenders is not null then
    raise exception 'AUDIT 2a: anon can touch tables: %', offenders;
  end if;

  -- 2a'. anon has no sequence privileges
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S'
    and case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'usage, select, update') else false end;
  if offenders is not null then
    raise exception 'AUDIT 2a: anon can use sequences: %', offenders;
  end if;

  -- 2b. anon cannot execute any of our functions (extension-owned ones are not ours)
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'execute');
  if offenders is not null then
    raise exception 'AUDIT 2b: anon can execute functions: %', offenders;
  end if;

  -- 2c. anon cannot even see the private schema
  if has_schema_privilege('anon', 'private', 'usage') then
    raise exception 'AUDIT 2c: anon has USAGE on schema private';
  end if;

  -- 3. tables that must be closed to signed-in users (reachable only through functions)
  select string_agg(t, ', ' order by t) into offenders
  from unnest(array[
    'workout_comments', 'rsf_heading', 'hoopers_checkins', 'rsf_presence',
    'leaderboard_members', 'admins', 'reports', 'blocked_terms', 'capacity_snapshots'
  ]) as t
  where to_regclass('public.' || t) is not null
    and has_table_privilege('authenticated', 'public.' || t,
          'select, insert, update, delete, truncate, references, trigger');
  if offenders is not null then
    raise exception 'AUDIT 3: signed-in users have direct access to closed tables: %', offenders;
  end if;

  -- 4. SECURITY DEFINER functions must pin search_path
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f' and p.prosecdef
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not coalesce((select bool_or(cfg like 'search_path=%') from unnest(p.proconfig) cfg), false);
  if offenders is not null then
    raise exception 'AUDIT 4: SECURITY DEFINER functions without a pinned search_path: %', offenders;
  end if;

  -- 5. trigger functions are not callable by app users
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname) into offenders
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prokind = 'f' and p.prorettype = 'trigger'::regtype
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('authenticated', p.oid, 'execute');
  if offenders is not null then
    raise exception 'AUDIT 5: signed-in users can call trigger functions: %', offenders;
  end if;

  -- 6. every table that signed-in users CAN touch directly has at least one policy
  select string_agg(c.relname, ', ' order by c.relname) into offenders
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> all (rls_exempt)
    and has_table_privilege('authenticated', c.oid, 'select, insert, update, delete')
    and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid);
  if offenders is not null then
    raise exception 'AUDIT 6: tables open to signed-in users with RLS on but no policy: %', offenders;
  end if;
end $$;

rollback;
