-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Hardening found by the whole-database security audit (tests/security_audit_test.sql).
--
-- 1. The signed-out role (anon) had table privileges on workouts, custom_exercises
--    and custom_day_types (migration 002 never revoked Supabase's defaults). Row-level
--    security already kept those tables empty for anon, but anon should have no
--    access at all, so this removes it. The app only ever uses the signed-in role.
-- 2. capacity_snapshots (RSF crowd history) is read and written only by the Render
--    server with the service-role key, which bypasses row-level security and keeps its
--    own privileges. Turn RLS on and close it to the API roles so it can never be
--    read or changed through the public API.

revoke all on public.workouts from anon;
revoke all on public.custom_exercises from anon;
revoke all on public.custom_day_types from anon;

do $$
begin
  if to_regclass('public.capacity_snapshots') is not null then
    alter table public.capacity_snapshots enable row level security;
    revoke all on public.capacity_snapshots from anon, authenticated;
  end if;
  if to_regclass('public.capacity_snapshots_id_seq') is not null then
    revoke all on sequence public.capacity_snapshots_id_seq from anon, authenticated;
  end if;
end $$;

-- 3. Signup trigger functions from migration 002 were reachable through the API.
--    Calling a trigger function directly always fails, but nobody should be able to
--    try. Triggers keep firing: EXECUTE is only checked when a trigger is created.
do $$
declare
  fn text;
begin
  foreach fn in array array['public.enforce_berkeley_email()', 'public.handle_new_user()'] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
