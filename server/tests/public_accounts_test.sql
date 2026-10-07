-- Public/private account tests (auto-accept, switching, visibility, Explore, profile lists). Safe to run in the Supabase SQL editor:
-- everything happens in a transaction that ends in ROLLBACK.
-- Success = it finishes with no error. Any failure raises an exception.
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
-- Fixtures. alice (a) and hank (h) will go public; bob (b) stays private.
--   dave (d) is bob's approved follower; carol (c), erin (e), gina (g) are strangers.
--   alice: wA1 shared, wA2 only-me.  bob: wB1 shared.  hank: wH1 shared.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'), ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'), ('99999999-0000-0000-0000-000000000009', 't_gina@berkeley.edu'),
  ('88888888-0000-0000-0000-000000000008', 't_hank@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  display_name = 'Erin',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
update public.profiles set username = 'gina_lifts',  display_name = 'Gina',  terms_version = 'test' where id = '99999999-0000-0000-0000-000000000009';
update public.profiles set username = 'hank_lifts',  display_name = 'Hank',  terms_version = 'test' where id = '88888888-0000-0000-0000-000000000008';

insert into public.workouts (id, user_id, date, day_type, exercises, visibility) values
  ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]', 'followers'),
  ('e2000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Legs","isCustom":false}', '[]', 'private'),
  ('e3000000-0000-0000-0000-0000000000e3', 'b0000000-0000-0000-0000-00000000000b', now(), '{"name":"Pull","isCustom":false}', '[]', 'followers'),
  ('e4000000-0000-0000-0000-0000000000e4', '88888888-0000-0000-0000-000000000008', now(), '{"name":"Arms","isCustom":false}', '[]', 'followers');
insert into public.follows (follower_id, followee_id, status) values ('d0000000-0000-0000-0000-00000000000d', 'b0000000-0000-0000-0000-00000000000b', 'accepted');

do $$ begin
  assert not (select is_public from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'new profiles start private';
end $$;

-- ---------------------------------------------------------------------------
-- while everyone is private, strangers get nothing
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
insert into public.follows (follower_id, followee_id) values ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a');   -- request to a private account
do $$ begin
  assert (select status from public.follows where follower_id = 'c0000000-0000-0000-0000-00000000000c' and followee_id = 'a0000000-0000-0000-0000-00000000000a') = 'pending', 'following a private account is a request';
  assert not private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'a pending requester cannot view';
  assert (select workout_count from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) is null, 'summary hides the workout count on a private account';
  assert not (select is_public from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')), 'summary reports private';
  assert (select count(*) from public.get_explore()) = 0, 'explore is empty while nobody is public';
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = 0, 'a private account''s lists are closed to strangers';
  assert (select count(*) from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a')) = 0, 'a private account''s profile shows no workouts to strangers';
end $$;

select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
insert into public.follows (follower_id, followee_id) values ('e0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000b');   -- pending request to bob, who stays private

-- ---------------------------------------------------------------------------
-- only you can change your own setting
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows($q$update public.profiles set is_public = true where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 0, 'cannot change someone else''s visibility');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail_msg($q$update public.profiles set username = 'x_hacker' where id = 'c0000000-0000-0000-0000-00000000000c'$q$, 'username_immutable', 'other protections still hold');

-- ---------------------------------------------------------------------------
-- going public approves the waiting requests, and only the owner's
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update public.profiles set is_public = true where id = 'a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_admin();
do $$ begin
  assert (select status from public.follows where follower_id = 'c0000000-0000-0000-0000-00000000000c' and followee_id = 'a0000000-0000-0000-0000-00000000000a') = 'accepted', 'going public accepts the pending request';
  assert (select status from public.follows where follower_id = 'e0000000-0000-0000-0000-00000000000e' and followee_id = 'b0000000-0000-0000-0000-00000000000b') = 'pending', 'but not requests to other (private) accounts';
end $$;
update public.profiles set is_public = true where id = '88888888-0000-0000-0000-000000000008';
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert not (select follows_you from public.get_profile_summary('e0000000-0000-0000-0000-00000000000e')), 'a pending request is not a follow: follows_you stays false';
end $$;
select pg_temp.as_admin();

-- ---------------------------------------------------------------------------
-- following: public is instant, private is a request, the client cannot choose
-- ---------------------------------------------------------------------------
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
insert into public.follows (follower_id, followee_id) values ('99999999-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-00000000000a');
insert into public.follows (follower_id, followee_id, status) values ('99999999-0000-0000-0000-000000000009', '88888888-0000-0000-0000-000000000008', 'pending');   -- asks for pending, still accepted
insert into public.follows (follower_id, followee_id, status) values ('99999999-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-00000000000b', 'accepted');  -- asks for accepted, stays pending
do $$ begin
  assert (select status from public.follows where followee_id = 'a0000000-0000-0000-0000-00000000000a' and follower_id = '99999999-0000-0000-0000-000000000009') = 'accepted', 'following a public account is instant';
  assert (select status from public.follows where followee_id = '88888888-0000-0000-0000-000000000008' and follower_id = '99999999-0000-0000-0000-000000000009') = 'accepted', 'status is decided by the server, not the client';
  assert (select status from public.follows where followee_id = 'b0000000-0000-0000-0000-00000000000b' and follower_id = '99999999-0000-0000-0000-000000000009') = 'pending', 'a client cannot approve itself on a private account';
end $$;
delete from public.follows where follower_id = '99999999-0000-0000-0000-000000000009';

-- The insert policy is a second lock, independent of the trigger.
select pg_temp.as_admin();
alter table public.follows disable trigger follows_autoaccept_trigger;
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
select pg_temp.expect_fail($q$insert into public.follows (follower_id, followee_id, status) values ('99999999-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-00000000000b', 'accepted')$q$, 'policy alone blocks self-approval on a private account');
insert into public.follows (follower_id, followee_id, status) values ('99999999-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-00000000000a', 'accepted');   -- fine: alice really is public
delete from public.follows where follower_id = '99999999-0000-0000-0000-000000000009';
select pg_temp.as_admin();
alter table public.follows enable trigger follows_autoaccept_trigger;

-- ---------------------------------------------------------------------------
-- what a stranger can see of a PUBLIC account (gina follows nobody)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
do $$ begin
  assert private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'a stranger can view a shared workout of a public account';
  assert not private.can_view_workout('e2000000-0000-0000-0000-0000000000e2'), 'but never an only-me workout';
  assert not private.can_view_workout('e3000000-0000-0000-0000-0000000000e3'), 'and nothing of a private account';
  assert (select workout_count from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 1, 'summary counts shared workouts only';
  assert (select is_public from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')), 'summary reports public';
  assert (select relationship from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 'none', 'relationship is none';
  assert (select array_agg(id) from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a')) = array['e1000000-0000-0000-0000-0000000000e1'::uuid], 'profile list shows the shared workout only';
  assert (select count(*) from public.get_user_workouts('b0000000-0000-0000-0000-00000000000b')) = 0, 'private account profile list is empty for strangers';
  assert (select array_agg(username order by username) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = array['carol_lifts'], 'a public account''s lists are open to strangers';
  assert (select count(*) from public.get_connections('b0000000-0000-0000-0000-00000000000b', 'followers')) = 0, 'a private account''s are not';
  assert (select array_agg(id order by id) from public.get_explore()) = array['e1000000-0000-0000-0000-0000000000e1'::uuid, 'e4000000-0000-0000-0000-0000000000e4'::uuid], 'explore: public accounts'' shared workouts only';
  -- reactions work on public workouts, and only those
  insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', '99999999-0000-0000-0000-000000000009');
  perform * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'Nice session!');
end $$;
select pg_temp.expect_fail($q$insert into public.workout_likes (workout_id, user_id) values ('e3000000-0000-0000-0000-0000000000e3', '99999999-0000-0000-0000-000000000009')$q$, 'cannot like a private account''s workout');
select pg_temp.expect_fail($q$insert into public.workout_likes (workout_id, user_id) values ('e2000000-0000-0000-0000-0000000000e2', '99999999-0000-0000-0000-000000000009')$q$, 'cannot like an only-me workout');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e3000000-0000-0000-0000-0000000000e3', 'hi')$q$, 'comment_target_not_found', 'cannot comment on a private account');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e2000000-0000-0000-0000-0000000000e2', 'hi')$q$, 'comment_target_not_found', 'cannot comment on an only-me workout');
do $$ begin
  assert (select count(*) from public.get_explore()) = 2, 'explore lists both public accounts'' shared workouts';
end $$;

-- "follows you": the other half of a friendship
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert not (select follows_you from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')), 'alice does not follow carol yet';
end $$;
select pg_temp.as_admin();
insert into public.follows (follower_id, followee_id, status) values ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'accepted');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select follows_you from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')), 'alice follows carol back';
  assert (select relationship from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 'following' and private.are_friends('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a'), 'mutual follows are friends';
end $$;
select pg_temp.as_admin();
delete from public.follows where follower_id = 'a0000000-0000-0000-0000-00000000000a' and followee_id = 'c0000000-0000-0000-0000-00000000000c';

-- the owner
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_explore()) = 1, 'explore excludes my own workouts (only hank''s remains)';
  assert (select array_agg(id order by id) from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a')) = array['e1000000-0000-0000-0000-0000000000e1'::uuid, 'e2000000-0000-0000-0000-0000000000e2'::uuid], 'my own profile list includes only-me workouts';
  assert (select array_agg(visibility order by id) from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a')) = array['followers', 'private'], 'and says which is which';
end $$;

-- ---------------------------------------------------------------------------
-- an approved follower of a private account sees its shared workouts and lists
-- ---------------------------------------------------------------------------
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert private.can_view_workout('e3000000-0000-0000-0000-0000000000e3'), 'an approved follower sees a private account''s shared workout';
  assert (select count(*) from public.get_user_workouts('b0000000-0000-0000-0000-00000000000b')) = 1, 'and its profile list';
  assert (select count(*) from public.get_explore()) = 2, 'explore still excludes the private account (alice + hank only)';
  assert (select workout_count from public.get_profile_summary('b0000000-0000-0000-0000-00000000000b')) = 1, 'summary shows the count to an approved follower';
end $$;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', '99999999-0000-0000-0000-000000000009');
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
do $$ begin
  assert not private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'a blocked user cannot view a public account''s workouts';
  assert (select array_agg(id) from public.get_explore()) = array['e4000000-0000-0000-0000-0000000000e4'::uuid], 'explore hides the blocker';
  assert (select count(*) from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')) = 0, 'profile summary returns nothing across a block';
  assert (select count(*) from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a')) = 0, 'profile list returns nothing across a block';
end $$;
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'let me in')$q$, 'comment_target_not_found', 'a blocked user cannot comment');

-- ---------------------------------------------------------------------------
-- going private again: followers stay, strangers lose access
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
delete from public.blocks where blocker_id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set is_public = false where id = 'a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'an existing follower keeps access after the account goes private';
end $$;
select pg_temp.as_user('99999999-0000-0000-0000-000000000009');
do $$ begin
  assert not private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'a stranger loses access';
  assert (select array_agg(id) from public.get_explore()) = array['e4000000-0000-0000-0000-0000000000e4'::uuid], 'and the account leaves explore';
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = 0, 'and its lists close';
end $$;
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.follows where followee_id = 'a0000000-0000-0000-0000-00000000000a' and status = 'accepted') = 1, 'followers were kept';
end $$;
update public.profiles set is_public = true where id = 'a0000000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------------------
-- explore window and pagination: 55 more shared workouts from alice, sharing
-- timestamps so the id tie-breaker is exercised; one old one is excluded.
-- ---------------------------------------------------------------------------
insert into public.workouts (id, user_id, date, day_type, exercises, visibility, created_at)
select gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Bulk","isCustom":false}', '[]', 'followers',
       now() - interval '1 hour' - ((g - 1) / 3) * interval '1 minute'
from generate_series(1, 55) g;
insert into public.workouts (id, user_id, date, day_type, exercises, visibility, created_at)
values (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Old","isCustom":false}', '[]', 'followers', now() - interval '40 days');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$
declare
  seen int := 0; pages int := 0; n int;
  cur_at timestamptz := null; cur_id uuid := null;
  uw int := 0; uw_pages int := 0;
begin
  loop
    select count(*), (array_agg(created_at order by created_at, id))[1], (array_agg(id order by created_at, id))[1]
      into n, cur_at, cur_id
    from public.get_explore(20, cur_at, cur_id);
    exit when n = 0;
    seen := seen + n; pages := pages + 1;
    assert pages < 10, 'explore pagination must terminate';
  end loop;
  -- wA1 + 55 bulk + wH1; the 40-day-old one is outside the window, wA2 is only-me
  assert seen = 57, format('explore visits every recent shared workout once, saw %s', seen);
  assert pages = 3, format('20 + 20 + 17, got %s pages', pages);
  cur_at := null; cur_id := null;
  loop
    select count(*), (array_agg(created_at order by created_at, id))[1], (array_agg(id order by created_at, id))[1]
      into n, cur_at, cur_id
    from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a', 20, cur_at, cur_id);
    exit when n = 0;
    uw := uw + n; uw_pages := uw_pages + 1;
    assert uw_pages < 10, 'profile pagination must terminate';
  end loop;
  assert uw = 57, format('profile list shows shared workouts incl. the old one (no window), saw %s', uw);
  assert (select count(*) from public.get_explore(1000)) = 50, 'explore page size capped at 50';
  assert (select count(*) from public.get_explore(0)) = 1, 'and floors at 1';
end $$;

-- ---------------------------------------------------------------------------
-- signed-out callers
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.get_explore()$q$, 'permission denied', 'anon cannot call get_explore');
select pg_temp.expect_fail_msg($q$select * from public.get_user_workouts('a0000000-0000-0000-0000-00000000000a')$q$, 'permission denied', 'anon cannot call get_user_workouts');
select pg_temp.expect_fail_msg($q$select * from public.get_profile_summary('a0000000-0000-0000-0000-00000000000a')$q$, 'permission denied', 'anon cannot call get_profile_summary');
select pg_temp.expect_fail_msg($q$select * from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')$q$, 'permission denied', 'anon cannot call get_connections');
select pg_temp.expect_fail_msg($q$select private.can_view_workout('e1000000-0000-0000-0000-0000000000e1')$q$, 'permission denied', 'anon cannot call can_view_workout');

select pg_temp.as_admin();
rollback;
