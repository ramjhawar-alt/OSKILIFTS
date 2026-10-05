-- Phase 1 invariants (accounts + workouts RLS). Safe to run in the Supabase SQL
-- editor: everything happens in a transaction that ends in ROLLBACK.
-- Success = it finishes with no error. Any failure raises an exception.
begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;

-- Statement must fail (error or RLS denial).
create function pg_temp.expect_fail(q text, label text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute q; exception when others then failed := true; end;
  if not failed then raise exception 'EXPECTED FAILURE BUT SUCCEEDED: %', label; end if;
end $$;

-- Statement must affect exactly n rows (RLS hides rows silently on UPDATE/DELETE).
create function pg_temp.expect_rows(q text, n int, label text) returns void language plpgsql as $$
declare got int;
begin
  execute q;
  get diagnostics got = row_count;
  if got <> n then raise exception 'EXPECTED % ROWS, GOT %: %', n, got, label; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as admin; fires the real auth.users triggers)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu');

do $$ begin
  assert (select count(*) from public.profiles
          where id in ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b')) = 2,
    'profiles are auto-created for new users';
end $$;

select pg_temp.expect_fail(
  $q$insert into auth.users (email) values ('t_mallory@gmail.com')$q$,
  'non-berkeley email must be rejected');
select pg_temp.expect_fail(
  $q$insert into auth.users (email) values ('t_mallory@berkeley.edu.evil.com')$q$,
  'lookalike domain must be rejected');

-- ---------------------------------------------------------------------------
-- workouts: owner-only
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.workouts (user_id, date, day_type, exercises)
values ('a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]');

do $$ begin
  assert (select count(*) from public.workouts) = 1, 'alice sees her own workout';
end $$;
select pg_temp.expect_fail(
  $q$insert into public.workouts (user_id, date, day_type, exercises)
     values ('b0000000-0000-0000-0000-00000000000b', now(), '{}', '[]')$q$,
  'alice cannot insert a workout owned by bob');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.workouts) = 0, 'bob cannot see alice''s workout';
end $$;
select pg_temp.expect_rows($q$update public.workouts set notes = 'pwned'$q$, 0, 'bob cannot update alice''s workout');
select pg_temp.expect_rows($q$delete from public.workouts$q$, 0, 'bob cannot delete alice''s workout');

select pg_temp.as_anon();
do $$ begin
  assert (select count(*) from public.workouts) = 0, 'anon sees no workouts';
end $$;

select pg_temp.as_admin();
rollback;
