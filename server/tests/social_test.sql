-- Social layer tests (follows, visibility, feed, profile summary, search; later
-- milestones append likes/blocks/reports). Safe to run in the Supabase SQL editor:
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
-- Fixtures: alice (a), bob (b), carol (c), dave (d); usernames claimed
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'),
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';

-- Alice's workouts: w1 uses the DEFAULT visibility, w2 is private.
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.workouts (id, user_id, date, day_type, exercises, notes)
values ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]', 'w1');
insert into public.workouts (id, user_id, date, day_type, exercises, notes, visibility)
values ('e2000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Legs","isCustom":false}', '[]', 'w2', 'private');
do $$ begin
  assert (select visibility from public.workouts where id = 'e1000000-0000-0000-0000-0000000000e1') = 'followers',
    'new workouts default to followers';
end $$;
select pg_temp.expect_fail($q$update public.workouts set visibility = 'public' where id = 'e1000000-0000-0000-0000-0000000000e1'$q$, 'visibility CHECK');

-- ---------------------------------------------------------------------------
-- follow requests
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select status from public.follows) = 'pending', 'request starts pending';
end $$;
select pg_temp.expect_fail($q$insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a')$q$, 'duplicate request');
select pg_temp.expect_fail($q$insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b')$q$, 'cannot follow yourself');
-- A client cannot pick its own status: asking for 'accepted' on a private account yields 'pending'.
insert into public.follows (follower_id, followee_id, status) values ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c', 'accepted');
do $$ begin
  assert (select status from public.follows where followee_id = 'c0000000-0000-0000-0000-00000000000c') = 'pending', 'cannot self-approve on insert: status is forced to pending';
end $$;
delete from public.follows where followee_id = 'c0000000-0000-0000-0000-00000000000c';
select pg_temp.expect_fail($q$insert into public.follows (follower_id, followee_id) values ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a')$q$, 'cannot request as someone else');
select pg_temp.expect_rows($q$update public.follows set status = 'accepted'$q$, 0, 'follower cannot accept their own request');

-- a pending follower sees nothing
do $$ begin
  assert (select count(*) from public.get_feed()) = 0, 'pending follower sees an empty feed';
  assert (select relationship from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 'pending_out', 'bob sees pending_out';
  assert (select workout_count from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) is null, 'pending follower gets no workout count';
  assert (select relationship from public.search_profiles('alice')) = 'pending_out', 'search shows pending_out';
end $$;

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.follows) = 0, 'third parties cannot see follow rows';
end $$;

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select relationship from public.get_profile_summary('b0000000-0000-0000-0000-00000000000b')) = 'pending_in', 'alice sees pending_in';
end $$;
-- Set status = 'accepted' too, so the row-level WITH CHECK would pass and only the
-- column-level grant stands in the way (isolates that protection).
select pg_temp.expect_fail_msg($q$update public.follows set follower_id = 'c0000000-0000-0000-0000-00000000000c', status = 'accepted'$q$, 'permission denied', 'followee cannot rewrite follower_id (column grant)');
select pg_temp.expect_fail_msg($q$update public.follows set followee_id = 'c0000000-0000-0000-0000-00000000000c', status = 'accepted'$q$, 'permission denied', 'followee cannot rewrite followee_id (column grant)');
select pg_temp.expect_rows($q$update public.follows set status = 'accepted' where follower_id = 'b0000000-0000-0000-0000-00000000000b'$q$, 1, 'alice accepts bob');
select pg_temp.expect_fail($q$update public.follows set status = 'pending'$q$, 'cannot move back to pending');

-- ---------------------------------------------------------------------------
-- workouts stay owner-only, even for an accepted follower
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.workouts) = 0, 'accepted follower still cannot select workouts directly';
  assert (select count(*) from public.workouts where user_id = 'a0000000-0000-0000-0000-00000000000a') = 0, 'explicit user_id filter still returns nothing';
end $$;
select pg_temp.expect_rows($q$update public.workouts set notes = 'x'$q$, 0, 'follower cannot update');
select pg_temp.expect_rows($q$delete from public.workouts$q$, 0, 'follower cannot delete');

-- ---------------------------------------------------------------------------
-- feed visibility
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.get_feed()) = 1, 'accepted follower sees exactly the shared workout';
  assert (select id from public.get_feed()) = 'e1000000-0000-0000-0000-0000000000e1', 'and it is w1, not the private w2';
  assert (select username from public.get_feed()) = 'alice_lifts', 'feed carries the author username';
  assert private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'follower can view w1';
  assert not private.can_view_workout('e2000000-0000-0000-0000-0000000000e2'), 'follower cannot view private w2';
  assert (select relationship from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 'following', 'relationship is following';
  assert (select workout_count from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 1, 'follower workout_count excludes private';
  assert (select cardinality(workout_dates) from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 1, 'follower workout_dates excludes private';
  assert (select relationship from public.search_profiles('alice')) = 'following', 'search shows following';
end $$;

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.get_feed()) = 0, 'non-follower feed is empty';
  assert not private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'non-follower cannot view w1';
end $$;

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_feed()) = 0, 'own workouts are not in your own feed';
  assert private.can_view_workout('e2000000-0000-0000-0000-0000000000e2'), 'owner can view own private workout';
  assert (select workout_count from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 2, 'self workout_count includes private';
  assert (select relationship from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 'self', 'self relationship';
end $$;

-- third-party view of a profile: counts yes, workouts no
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ declare r record; begin
  select * into r from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a');
  assert r.follower_count = 1 and r.following_count = 0, 'third party sees correct follower/following counts';
  assert r.relationship = 'none', 'third party relationship none';
  assert r.workout_count is null and r.workout_dates is null, 'third party gets no workout data';
  assert (select count(*) from public.get_profile_summary('00000000-0000-0000-0000-000000000099')) = 0, 'unknown user returns no row';
end $$;

-- flipping a workout to private removes it from the feed immediately
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update public.workouts set visibility = 'private' where id = 'e1000000-0000-0000-0000-0000000000e1';
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.get_feed()) = 0, 'private flip hides it from followers';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update public.workouts set visibility = 'followers' where id = 'e1000000-0000-0000-0000-0000000000e1';

-- ---------------------------------------------------------------------------
-- pagination: keyset on (created_at, id) is stable across created_at ties
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
insert into public.workouts (id, user_id, date, day_type, exercises, created_at)
select ('f' || g || '000000-0000-0000-0000-0000000000f' || g)::uuid,
       'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Tie","isCustom":false}', '[]',
       '2026-01-01 00:00:00.123456+00'
from generate_series(1, 5) g;

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$
declare
  cur_ts timestamptz; cur_id uuid; got int; seen uuid[] := '{}'; r record;
  pages int := 0; prev_ts timestamptz; prev_id uuid;
begin
  loop
    got := 0;
    for r in select * from public.get_feed(2, cur_ts, cur_id) loop
      assert not (r.id = any(seen)), 'duplicate row across pages';
      if prev_ts is not null then
        assert (r.created_at, r.id) < (prev_ts, prev_id), 'rows are in strictly descending (created_at, id) order';
      end if;
      seen := seen || r.id; prev_ts := r.created_at; prev_id := r.id;
      cur_ts := r.created_at; cur_id := r.id; got := got + 1;
    end loop;
    pages := pages + 1;
    exit when got < 2;
    assert pages < 20, 'pagination did not terminate';
  end loop;
  assert cardinality(seen) = 6, format('expected 6 shared workouts across pages, saw %s', cardinality(seen));
  assert (select count(*) from public.get_feed(500)) = 6, 'limit is clamped but still returns all 6';
  assert (select count(*) from public.get_feed(0)) = 1, 'limit is clamped to at least 1';
end $$;

-- ---------------------------------------------------------------------------
-- search
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.search_profiles('a')) = 0, 'prefix under 2 chars returns nothing';
  assert (select count(*) from public.search_profiles('  ')) = 0, 'blank prefix returns nothing';
  assert (select count(*) from public.search_profiles('%%')) = 0, 'LIKE wildcards are escaped (%)';
  assert (select count(*) from public.search_profiles('__')) = 0, 'LIKE wildcards are escaped (_)';
  assert (select count(*) from public.search_profiles('_lifts')) = 0, 'prefix search does not match mid-string';
  assert (select count(*) from public.search_profiles('alice_')) = 1, 'underscore is matched literally';
  assert (select count(*) from public.search_profiles('ALI')) = 1, 'search is case-insensitive';
  assert (select count(*) from public.search_profiles('bo')) = 0, 'search excludes yourself';
  assert (select count(*) from public.search_profiles('c')) = 0, 'single char returns nothing';
  assert (select count(*) from public.search_profiles('ca')) = 1, 'finds carol';
end $$;

-- ---------------------------------------------------------------------------
-- unfollow / reject / remove follower
-- ---------------------------------------------------------------------------
select pg_temp.expect_rows($q$delete from public.follows where follower_id = 'b0000000-0000-0000-0000-00000000000b'$q$, 1, 'bob unfollows alice');
do $$ begin
  assert (select count(*) from public.get_feed()) = 0, 'after unfollow the feed is empty';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
insert into public.follows (follower_id, followee_id) values ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_rows($q$delete from public.follows$q$, 0, 'a third party cannot delete follow rows');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($q$delete from public.follows where follower_id = 'c0000000-0000-0000-0000-00000000000c'$q$, 1, 'alice rejects carol''s request');

-- ---------------------------------------------------------------------------
-- abuse caps
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
insert into auth.users (id, email)
select ('90000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 't_target' || g || '@berkeley.edu'
from generate_series(1, 101) g;
insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'),
  ('f0000000-0000-0000-0000-00000000000f', 't_frank@berkeley.edu');

-- erin already has 100 old pending requests -> the 101st is refused
insert into public.follows (follower_id, followee_id, created_at)
select 'e0000000-0000-0000-0000-00000000000e', id, now() - interval '3 hours'
from (select id from auth.users where email like 't\_target%' order by id limit 100) t;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select pg_temp.expect_fail_msg(
  $q$insert into public.follows (follower_id, followee_id)
     values ('e0000000-0000-0000-0000-00000000000e', '90000000-0000-0000-0000-000000000101')$q$,
  'too_many_pending_requests', 'pending request cap');

-- frank made 30 follows in the last hour -> the 31st is rate limited
select pg_temp.as_admin();
insert into public.follows (follower_id, followee_id, status)
select 'f0000000-0000-0000-0000-00000000000f', id, 'accepted'
from (select id from auth.users where email like 't\_target%' order by id limit 30) t;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.expect_fail_msg(
  $q$insert into public.follows (follower_id, followee_id)
     values ('f0000000-0000-0000-0000-00000000000f', '90000000-0000-0000-0000-000000000101')$q$,
  'follow_rate_limited', 'hourly follow rate limit');

-- ---------------------------------------------------------------------------
-- anon can touch none of it
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.follows$q$, 'anon cannot read follows');
select pg_temp.expect_fail($q$select * from public.get_feed()$q$, 'anon cannot call get_feed');
select pg_temp.expect_fail($q$select * from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')$q$, 'anon cannot call get_profile_summary');
select pg_temp.expect_fail($q$select * from public.search_profiles('al')$q$, 'anon cannot call search_profiles');
select pg_temp.expect_fail($q$select private.can_view_workout('e1000000-0000-0000-0000-0000000000e1')$q$, 'anon cannot call private helpers');

select pg_temp.as_admin();
rollback;
