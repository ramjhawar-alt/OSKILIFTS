-- Safety + engagement tests: likes, blocks, reports, account deletion. Safe to run in the Supabase SQL editor:
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
-- Fixtures: alice follows nobody; bob and alice follow each other (accepted)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'),
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
insert into public.follows (follower_id, followee_id, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted');
insert into public.workouts (id, user_id, date, day_type, exercises, notes, visibility) values
  ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]', 'alice shared', 'followers'),
  ('e2000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Legs","isCustom":false}', '[]', 'alice private', 'private'),
  ('e3000000-0000-0000-0000-0000000000e3', 'b0000000-0000-0000-0000-00000000000b', now(), '{"name":"Pull","isCustom":false}', '[]', 'bob shared', 'followers');

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b')$q$, 'duplicate like');
select pg_temp.expect_fail($q$insert into public.workout_likes (workout_id, user_id) values ('e2000000-0000-0000-0000-0000000000e2', 'b0000000-0000-0000-0000-00000000000b')$q$, 'cannot like a private workout');
select pg_temp.expect_fail($q$insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a')$q$, 'cannot like as someone else');
do $$ begin
  assert (select like_count from public.get_feed() where id = 'e1000000-0000-0000-0000-0000000000e1') = 1, 'like_count is 1';
  assert (select liked_by_me from public.get_feed() where id = 'e1000000-0000-0000-0000-0000000000e1'), 'liked_by_me is true for bob';
  assert not (select liked_by_me from public.get_feed() where id = 'e1000000-0000-0000-0000-0000000000e1') is null, 'row present';
end $$;

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail($q$insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'c0000000-0000-0000-0000-00000000000c')$q$, 'a non-follower cannot like');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.workout_likes (workout_id, user_id) values ('e3000000-0000-0000-0000-0000000000e3', 'a0000000-0000-0000-0000-00000000000a');
insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.workout_likes) = 2, 'alice sees only her own like rows';
  assert (select like_count from public.get_feed() where id = 'e3000000-0000-0000-0000-0000000000e3') = 1, 'bob''s workout shows alice''s like';
end $$;
select pg_temp.expect_rows($q$delete from public.workout_likes where user_id = 'b0000000-0000-0000-0000-00000000000b'$q$, 0, 'cannot delete others'' likes');
select pg_temp.expect_fail($q$update public.workout_likes set user_id = 'b0000000-0000-0000-0000-00000000000b'$q$, 'likes are not updatable');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select like_count from public.get_feed() where id = 'e1000000-0000-0000-0000-0000000000e1') = 2, 'both likes counted';
end $$;
select pg_temp.expect_rows($q$delete from public.workout_likes where workout_id = 'e1000000-0000-0000-0000-0000000000e1'$q$, 1, 'bob removes only his own like');
insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b');

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.workout_likes$q$, 'anon cannot read likes');

-- ---------------------------------------------------------------------------
-- reports (before blocks, while bob can still see alice's workout)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select * from public.reports$q$, 'clients cannot read reports');
select pg_temp.expect_fail($q$insert into public.reports (reporter_id, target_type, target_id, reason) values ('b0000000-0000-0000-0000-00000000000b', 'workout', gen_random_uuid(), 'spam')$q$, 'clients cannot insert reports directly');
select public.submit_report('workout', 'e1000000-0000-0000-0000-0000000000e1', 'spam', 'looks like an ad');
select public.submit_report('workout', 'e1000000-0000-0000-0000-0000000000e1', 'spam', 'looks like an ad');
select public.submit_report('profile', 'a0000000-0000-0000-0000-00000000000a', 'impersonation', null);
select pg_temp.expect_fail_msg($q$select public.submit_report('workout', 'e2000000-0000-0000-0000-0000000000e2', 'spam')$q$, 'report_target_not_found', 'cannot report a workout you cannot see');
select pg_temp.expect_fail_msg($q$select public.submit_report('profile', 'b0000000-0000-0000-0000-00000000000b', 'spam')$q$, 'cannot_report_self', 'cannot report yourself');
select pg_temp.expect_fail_msg($q$select public.submit_report('profile', '00000000-0000-0000-0000-000000000099', 'spam')$q$, 'report_target_not_found', 'unknown profile');
select pg_temp.expect_fail_msg($q$select public.submit_report('comment', gen_random_uuid(), 'spam')$q$, 'invalid_target_type', 'bad target type');
select pg_temp.expect_fail($q$select public.submit_report('profile', 'a0000000-0000-0000-0000-00000000000a', 'because')$q$, 'reason must be from the enum');
select pg_temp.expect_fail($q$select public.submit_report('profile', 'c0000000-0000-0000-0000-00000000000c', 'spam', repeat('x', 1001))$q$, 'details length cap');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail_msg($q$select public.submit_report('workout', 'e1000000-0000-0000-0000-0000000000e1', 'spam')$q$, 'report_target_not_found', 'a non-follower cannot report a workout it cannot see');

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.submit_report('profile', 'a0000000-0000-0000-0000-00000000000a', 'spam')$q$, 'anon cannot submit reports');
select pg_temp.as_admin();
do $$ declare r record; begin
  assert (select count(*) from public.reports where reporter_id = 'b0000000-0000-0000-0000-00000000000b') = 2, 'duplicate report was a no-op (2 distinct reports)';
  select * into r from public.reports where target_type = 'workout';
  assert r.reported_user_id = 'a0000000-0000-0000-0000-00000000000a', 'reported user derived server-side';
  assert r.snapshot ->> 'notes' = 'alice shared', 'snapshot keeps the reported content';
  assert r.status = 'open', 'new reports are open';
end $$;

-- rate limit: 20 per 24h
insert into auth.users (id, email)
select ('9a000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 't_rt' || g || '@berkeley.edu' from generate_series(1, 25) g;
insert into auth.users (id, email) values ('9a000000-0000-0000-0000-00000000009a', 't_gina@berkeley.edu');
select pg_temp.as_user('9a000000-0000-0000-0000-00000000009a');
do $$ declare i int; begin
  for i in 1..20 loop
    perform public.submit_report('profile', ('9a000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'spam');
  end loop;
end $$;
select pg_temp.expect_fail_msg($q$select public.submit_report('profile', '9a000000-0000-0000-0000-000000000021', 'spam')$q$, 'report_rate_limited', '21st report in a day');

-- ---------------------------------------------------------------------------
-- blocks: alice blocks bob
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')$q$, 'cannot create a block as someone else');
select pg_temp.expect_fail($q$insert into public.blocks (blocker_id, blocked_id) values ('b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b')$q$, 'cannot block yourself');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')$q$, 'duplicate block');

do $$ begin
  assert (select count(*) from public.follows) = 0, 'block removed follows in both directions';
  assert (select count(*) from public.blocks) = 1, 'alice sees her block';
  assert (select count(*) from public.profiles where id = 'b0000000-0000-0000-0000-00000000000b') = 1, 'blocker can still read the blocked user''s profile (for the Unblock list)';
  assert (select count(*) from public.search_profiles('bob')) = 0, 'blocker does not find the blocked user in search';
  assert (select count(*) from public.get_profile_summary('b0000000-0000-0000-0000-00000000000b')) = 0, 'no profile summary across a block (blocker side)';
  assert (select count(*) from public.workout_likes) = 1, 'alice''s like on bob''s workout was removed (her like on her own remains)';
end $$;
select pg_temp.expect_fail_msg($q$insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')$q$, 'follow_blocked', 'blocker cannot follow the blocked user');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.blocks) = 0, 'blocked user cannot see the block row';
  assert (select count(*) from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a') = 0, 'blocked user cannot read the blocker''s profile';
  assert (select count(*) from public.search_profiles('alice')) = 0, 'blocked user cannot find the blocker';
  assert (select count(*) from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 0, 'no profile summary across a block (blocked side)';
  assert (select count(*) from public.get_feed()) = 0, 'blocked user''s feed has nothing from the blocker';
  assert (select count(*) from public.workout_likes) = 0, 'bob''s like on alice''s workout was removed';
  assert not private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'blocked user cannot view the blocker''s workouts';
end $$;
select pg_temp.expect_fail_msg($q$insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a')$q$, 'follow_blocked', 'blocked user cannot request to follow the blocker');
select pg_temp.expect_fail_msg($q$select public.submit_report('profile', 'a0000000-0000-0000-0000-00000000000a', 'spam')$q$, 'report_target_not_found', 'blocked user cannot see (so cannot report) the blocker profile');

-- unblock restores visibility but NOT follows
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($q$delete from public.blocks where blocked_id = 'b0000000-0000-0000-0000-00000000000b'$q$, 1, 'alice unblocks bob');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a') = 1, 'profile visible again after unblock';
  assert (select count(*) from public.follows) = 0, 'unblock does not restore follows';
  assert (select count(*) from public.get_feed()) = 0, 'and the feed stays empty until bob re-follows';
end $$;
insert into public.follows (follower_id, followee_id) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------------------
-- account deletion
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select public.delete_my_account()$q$, 'anon cannot delete accounts');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert not exists (select 1 from auth.users where id = 'a0000000-0000-0000-0000-00000000000a'), 'auth user deleted';
  assert not exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'profile cascaded';
  assert not exists (select 1 from public.workouts where user_id = 'a0000000-0000-0000-0000-00000000000a'), 'workouts cascaded';
  assert not exists (select 1 from public.follows where follower_id = 'a0000000-0000-0000-0000-00000000000a' or followee_id = 'a0000000-0000-0000-0000-00000000000a'), 'follows cascaded';
  assert not exists (select 1 from public.workout_likes where workout_id = 'e1000000-0000-0000-0000-0000000000e1'), 'likes on deleted workouts cascaded';
  assert exists (select 1 from public.profiles where id = 'b0000000-0000-0000-0000-00000000000b'), 'other users untouched';
  assert exists (select 1 from public.workouts where user_id = 'b0000000-0000-0000-0000-00000000000b'), 'other users'' workouts untouched';
  assert (select count(*) from public.reports where reporter_id = 'b0000000-0000-0000-0000-00000000000b') = 2, 'reports survive account deletion';
  assert (select count(*) from public.reports where reporter_id = 'b0000000-0000-0000-0000-00000000000b' and reported_user_id is null) = 2, 'reported_user_id is nulled';
  assert (select snapshot ->> 'notes' from public.reports where target_type = 'workout') = 'alice shared', 'snapshot evidence kept';
end $$;

rollback;
