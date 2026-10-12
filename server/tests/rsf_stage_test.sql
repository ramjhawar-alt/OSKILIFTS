-- "Friends at the RSF" bear stages (migration 020): who is listed, and the stage computed from each
-- friend's SHARED workouts only (training days in a row, up to 2 rest days allowed, 10 per stage, max 10).
-- Safe to run in the Supabase SQL editor: everything happens in a transaction that ends in ROLLBACK.
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
-- Fixtures. alice (a) is the viewer. Each "friend" is mutual with alice and at the RSF.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';

create function pg_temp.uid(n int) returns uuid language sql as $$
  select format('f%s-0000-0000-0000-%s', lpad(n::text, 7, '0'), lpad(n::text, 12, '0'))::uuid
$$;
-- Berkeley's today, and a workout `back` days ago stored at noon UTC like the app does
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'America/Los_Angeles')::date $$;
create function pg_temp.stamp(back int) returns timestamptz language sql as $$
  select ((pg_temp.today() - back) + time '12:00') at time zone 'UTC'
$$;
create function pg_temp.friend(n int, uname text) returns void language plpgsql as $$
begin
  insert into auth.users (id, email) values (pg_temp.uid(n), uname || '@berkeley.edu');
  update public.profiles set username = uname, display_name = uname, terms_version = 'test' where id = pg_temp.uid(n);
  insert into public.follows (follower_id, followee_id, status) values
    ('a0000000-0000-0000-0000-00000000000a', pg_temp.uid(n), 'accepted'),
    (pg_temp.uid(n), 'a0000000-0000-0000-0000-00000000000a', 'accepted');
  insert into public.rsf_presence (user_id, expires_at) values (pg_temp.uid(n), now() + interval '1 hour');
end $$;
-- `count` workouts on consecutive days going back in time, the newest `start` days ago (negative start = future)
create function pg_temp.run(n int, count int, start int, vis text default 'followers') returns void language plpgsql as $$
begin
  insert into public.workouts (user_id, date, day_type, exercises, visibility)
  select pg_temp.uid(n), pg_temp.stamp(start + i), '{"name":"Day","isCustom":false}', '[]', vis from generate_series(0, count - 1) i;
end $$;
create function pg_temp.stage_of(uname text) returns int language sql as $$
  select stage from public.get_friends_at_rsf_stages() where username = uname
$$;

select pg_temp.friend(1, 'stage_one');        -- no workouts at all
select pg_temp.friend(2, 'nine_days');        select pg_temp.run(2, 9, 0);
select pg_temp.friend(3, 'ten_days');         select pg_temp.run(3, 10, 0);
select pg_temp.friend(4, 'big_streak');       select pg_temp.run(4, 95, 0);
select pg_temp.friend(5, 'huge_streak');      select pg_temp.run(5, 300, 0);
select pg_temp.friend(6, 'private_only');     select pg_temp.run(6, 40, 0, 'private');
select pg_temp.friend(7, 'mixed_visibility'); select pg_temp.run(7, 10, 0); select pg_temp.run(7, 25, 0, 'private');
select pg_temp.friend(8, 'every_third_day');  -- 12 workouts, 2 rest days between each: still one streak
insert into public.workouts (user_id, date, day_type, exercises, visibility)
  select pg_temp.uid(8), pg_temp.stamp(i * 3), '{"name":"Day","isCustom":false}', '[]', 'followers' from generate_series(0, 11) i;
select pg_temp.friend(9, 'three_rest_days');  -- 10 recent workouts, then 3 rest days in a row, then 30 older ones
select pg_temp.run(9, 10, 0); select pg_temp.run(9, 30, 13);
select pg_temp.friend(10, 'last_alive');      select pg_temp.run(10, 10, 3);   -- last workout 3 days ago: two rest days so far, still alive
select pg_temp.friend(11, 'just_lapsed');     select pg_temp.run(11, 10, 4);   -- last workout 4 days ago: a third rest day has passed
select pg_temp.friend(12, 'future_only');     select pg_temp.run(12, 30, -30); -- the next 30 days (all in the future): nothing yet
select pg_temp.friend(13, 'future_and_today'); select pg_temp.run(13, 30, -30); select pg_temp.run(13, 1, 0);
select pg_temp.friend(14, 'dupes');           -- three workouts every day for 10 days still count as 10 days
select pg_temp.run(14, 10, 0); select pg_temp.run(14, 10, 0); select pg_temp.run(14, 10, 0);

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert pg_temp.stage_of('stage_one') = 1, 'no workouts is stage 1';
  assert pg_temp.stage_of('nine_days') = 1, '9 workouts is still stage 1';
  assert pg_temp.stage_of('ten_days') = 2, '10 workouts reaches stage 2';
  assert pg_temp.stage_of('big_streak') = 10, '95 workouts is MAX OSKI (stage 10 starts at 90)';
  assert pg_temp.stage_of('huge_streak') = 10, 'stage is capped at 10';
  assert pg_temp.stage_of('private_only') = 1, 'private workouts never count toward what friends see';
  assert pg_temp.stage_of('mixed_visibility') = 2, 'only the 10 shared workouts count, not the 25 private ones';
  assert pg_temp.stage_of('every_third_day') = 2, 'two rest days between workouts keep the streak (12 workouts)';
  assert pg_temp.stage_of('three_rest_days') = 2, 'three rest days in a row end the streak: only the recent 10 count, not the 30 before the gap';
  assert pg_temp.stage_of('last_alive') = 2, 'last workout 3 days ago: still alive';
  assert pg_temp.stage_of('just_lapsed') = 1, 'last workout 4 days ago: the streak has ended';
  assert pg_temp.stage_of('future_only') = 1, 'workouts dated in the future do not count';
  assert pg_temp.stage_of('future_and_today') = 1, 'only today counts, not the future ones';
  assert pg_temp.stage_of('dupes') = 2, 'several workouts on one day count as one day';
end $$;

-- who is listed: friends only, no blocks, same as the original function
select pg_temp.as_admin();
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'), ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),
  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu');
update public.profiles set username = 'carol_lifts', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
update public.profiles set username = 'bob_lifts',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
insert into public.follows (follower_id, followee_id, status) values
  ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),   -- carol follows alice one-way
  ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'accepted'), ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'pending'),
  ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted'), ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted');
insert into public.blocks (blocker_id, blocked_id) values ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a');
insert into public.rsf_presence (user_id, expires_at) select id, now() + interval '1 hour' from auth.users
  where id in ('c0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000b');
-- bob also has an expired presence row lingering: must not show
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert pg_temp.stage_of('bob_lifts') = 1, 'a friend with no workouts is stage 1';
  assert pg_temp.stage_of('carol_lifts') is null, 'a one-way follower is not listed';
  assert pg_temp.stage_of('dave_lifts') is null, 'a pending request is not listed';
  assert pg_temp.stage_of('erin_lifts') is null, 'someone who blocked me is not listed';
  assert (select count(*) from public.get_friends_at_rsf_stages()) = 15, 'alice sees exactly her 14 stage friends and bob';
  assert (select array_agg(username order by username) from public.get_friends_at_rsf_stages())
       = (select array_agg(username order by username) from public.get_friends_at_rsf()), 'same people as the original function';
end $$;
-- the original function still has its original shape
do $$ begin
  assert (select count(*) from information_schema.parameters
          where parameter_mode = 'OUT'
            and specific_name = (select specific_name from information_schema.routines
                                 where routine_schema = 'public' and routine_name = 'get_friends_at_rsf')) = 5,
    'get_friends_at_rsf still returns its original 5 columns';
end $$;

-- expiry and strangers
select pg_temp.as_admin();
update public.rsf_presence set arrived_at = now() - interval '2 hours', expires_at = now() - interval '1 minute' where user_id = pg_temp.uid(3);
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert pg_temp.stage_of('ten_days') is null, 'an expired presence is not listed';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.get_friends_at_rsf_stages()) = 0, 'a one-way follower sees nobody';
end $$;

-- privileges: signed-out users cannot call it, and nobody can call the helper directly
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.get_friends_at_rsf_stages()$q$, 'anon cannot list friends at the RSF');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select private.shared_bear_stage('b0000000-0000-0000-0000-00000000000b')$q$, 'signed-in users cannot call the helper to read anyone''s stage');

rollback;
