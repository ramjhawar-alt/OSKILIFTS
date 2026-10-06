-- Phase 3 foundations (migration 006): weight unit, custom exercise types,
-- workout size limits, and per-set (v2) data flowing through feed and reports. Safe to run in the Supabase SQL editor:
-- everything happens in a transaction that ends in ROLLBACK.
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

-- Statement must fail AND the error message must contain `needle`.
create function pg_temp.expect_fail_msg(q text, needle text, label text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute q; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'EXPECTED FAILURE BUT SUCCEEDED: %', label; end if;
  if position(needle in msg) = 0 then
    raise exception 'WRONG ERROR for %: wanted "%" got "%"', label, needle, msg;
  end if;
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
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
insert into public.follows (follower_id, followee_id, status) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted');

-- ---------------------------------------------------------------------------
-- profiles.weight_unit
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select weight_unit from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a') = 'lb', 'weight_unit defaults to lb';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($q$update public.profiles set weight_unit = 'kg' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 1, 'a user can change their own unit (column grant present after all migrations)');
select pg_temp.expect_fail($q$update public.profiles set weight_unit = 'stone' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'unit must be lb or kg');
select pg_temp.expect_rows($q$update public.profiles set weight_unit = 'kg' where id = 'b0000000-0000-0000-0000-00000000000b'$q$, 0, 'cannot change another user''s unit');
select pg_temp.expect_fail($q$update public.profiles set username = 'alice_two' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'username stays immutable');
do $$ begin
  assert (select weight_unit from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a') = 'kg', 'unit persisted';
end $$;
select pg_temp.as_anon();
select pg_temp.expect_fail($q$update public.profiles set weight_unit = 'kg'$q$, 'anon cannot update profiles');

-- ---------------------------------------------------------------------------
-- custom exercise types
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.custom_exercises (user_id, name) values ('a0000000-0000-0000-0000-00000000000a', 'My Lift');
insert into public.custom_exercises (user_id, name, exercise_type) values ('a0000000-0000-0000-0000-00000000000a', 'My Run', 'distance_duration');
do $$ begin
  assert (select exercise_type from public.custom_exercises where name = 'My Lift') = 'weight_reps', 'custom exercise type defaults to weight_reps';
end $$;
select pg_temp.expect_fail($q$insert into public.custom_exercises (user_id, name, exercise_type) values ('a0000000-0000-0000-0000-00000000000a', 'Bad', 'telepathy')$q$, 'exercise type CHECK');

-- ---------------------------------------------------------------------------
-- workout size/shape limits
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.workouts (user_id, date, day_type, exercises)
select 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"X","isCustom":false}',
       (select jsonb_agg(jsonb_build_object('exercise', jsonb_build_object('name','e'||g,'isCustom',false), 'sets', 1, 'reps', 1)) from generate_series(1, 60) g);
select pg_temp.expect_fail($q$insert into public.workouts (user_id, date, day_type, exercises)
  select 'a0000000-0000-0000-0000-00000000000a', now(), '{}',
         (select jsonb_agg(jsonb_build_object('exercise', jsonb_build_object('name','e'||g), 'sets', 1, 'reps', 1)) from generate_series(1, 61) g)$q$, '61 entries rejected');
select pg_temp.expect_fail($q$insert into public.workouts (user_id, date, day_type, exercises)
  select 'a0000000-0000-0000-0000-00000000000a', now(), '{}',
         (select jsonb_agg(jsonb_build_object('exercise', jsonb_build_object('name','e'), 'pad', repeat('x', 2100))) from generate_series(1, 60))$q$, 'payload over 120 KB rejected');
insert into public.workouts (user_id, date, day_type, exercises)
select 'a0000000-0000-0000-0000-00000000000a', now(), '{}',
       (select jsonb_agg(jsonb_build_object('exercise', jsonb_build_object('name','e'), 'pad', repeat('x', 1500))) from generate_series(1, 60));
select pg_temp.expect_fail($q$insert into public.workouts (user_id, date, day_type, exercises)
  values ('a0000000-0000-0000-0000-00000000000a', now(), '{}', '{"not":"an array"}')$q$, 'exercises must be an array');
select pg_temp.expect_fail($q$insert into public.workouts (user_id, date, day_type, exercises)
  values ('a0000000-0000-0000-0000-00000000000a', now(), '{}', jsonb_build_array(jsonb_build_object('v', 2, 'exercise', jsonb_build_object('name','x'),
    'log', (select jsonb_agg(jsonb_build_object('kg', 50, 'reps', 5)) from generate_series(1, 61)))))$q$, 'a 61-set log is rejected');
insert into public.workouts (user_id, date, day_type, exercises)
  values ('a0000000-0000-0000-0000-00000000000a', now(), '{}', jsonb_build_array(jsonb_build_object('v', 2, 'exercise', jsonb_build_object('name','x'),
    'log', (select jsonb_agg(jsonb_build_object('kg', 50, 'reps', 5)) from generate_series(1, 60)))));
select pg_temp.expect_fail($q$insert into public.workouts (user_id, date, day_type, exercises, notes)
  values ('a0000000-0000-0000-0000-00000000000a', now(), '{}', '[]', repeat('n', 2001))$q$, 'notes over 2000 chars rejected');
select pg_temp.expect_fail($q$insert into public.workouts (user_id, date, day_type, exercises)
  values ('a0000000-0000-0000-0000-00000000000a', now(), jsonb_build_object('name', repeat('d', 400)), '[]')$q$, 'oversized day_type rejected');
select pg_temp.expect_fail($q$update public.workouts set exercises = '{}'::jsonb$q$, 'updates are checked too');

-- ---------------------------------------------------------------------------
-- per-set (v2) data flows through feed and report snapshots verbatim
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.workouts (id, user_id, date, day_type, exercises, notes, visibility) values (
  'e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}',
  '[{"v":2,"exercise":{"name":"Bench Press","isCustom":false,"type":"weight_reps"},"log":[{"kg":83.9146,"reps":8},{"kg":88.4505,"reps":5,"kind":"failure"}],"prs":["e1rm"],"sets":2,"reps":[8,5]},
    {"exercise":{"name":"Squat","isCustom":false},"sets":3,"reps":10}]'::jsonb,
  'v2 and legacy together', 'followers');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ declare r jsonb; begin
  select exercises into r from public.get_feed() where id = 'e1000000-0000-0000-0000-0000000000e1';
  assert r -> 0 -> 'log' -> 1 ->> 'kind' = 'failure', 'v2 log reaches the follower unchanged';
  assert (r -> 0 -> 'log' -> 0 ->> 'kg')::numeric = 83.9146, 'kg preserved';
  assert r -> 0 -> 'prs' ->> 0 = 'e1rm', 'prs preserved';
  assert (r -> 1 ->> 'sets')::int = 3 and (r -> 1 ->> 'reps')::int = 10, 'legacy entry unchanged alongside v2';
end $$;
select public.submit_report('workout', 'e1000000-0000-0000-0000-0000000000e1', 'spam');
select pg_temp.as_admin();
do $$ begin
  assert (select snapshot -> 'exercises' -> 0 -> 'log' -> 1 ->> 'kind' from public.reports where target_type = 'workout') = 'failure',
    'report snapshot keeps the per-set log';
end $$;

rollback;
