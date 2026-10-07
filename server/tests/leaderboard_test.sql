-- Weekly leaderboard tests (opt-in both ways, friends only, distinct days, week boundaries). Safe to run in the Supabase SQL editor:
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
-- Fixtures. alice (a) with friends bob (b), erin (e), dave (d); carol (c) follows
-- alice one-way; nameless (f) has no username.
--   joined: alice, bob, carol, erin.  NOT joined: dave.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'), ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'), ('f0000000-0000-0000-0000-00000000000f', 't_nameless@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  display_name = 'Erin',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
insert into public.follows (follower_id, followee_id, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted'), ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'accepted'), ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted');

-- Workouts on chosen days of the current Pacific week (ws = Monday), stored at noon UTC.
create function pg_temp.day(k int) returns timestamptz language sql as $$
  select (((date_trunc('week', now() at time zone 'America/Los_Angeles'))::date + k) + time '12:00') at time zone 'UTC'
$$;
insert into public.workouts (user_id, date, day_type, exercises, visibility) values
  -- alice: 3 different days; two workouts on day 1 count once
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(0), '{"name":"Push","isCustom":false}', '[]', 'followers'),
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(1), '{"name":"Pull","isCustom":false}', '[]', 'followers'),
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(1), '{"name":"Legs","isCustom":false}', '[]', 'followers'),
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(2), '{"name":"Arms","isCustom":false}', '[]', 'private'),
  -- bob: 4 days, plus Sunday of LAST week and Monday of NEXT week (must not count)
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(0), '{"name":"A","isCustom":false}', '[]', 'followers'),
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(2), '{"name":"A","isCustom":false}', '[]', 'followers'),
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(4), '{"name":"A","isCustom":false}', '[]', 'followers'),
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(6), '{"name":"A","isCustom":false}', '[]', 'followers'),
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(-1), '{"name":"Old","isCustom":false}', '[]', 'followers'),
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(7), '{"name":"Next","isCustom":false}', '[]', 'followers'),
  -- erin: 3 days (ties with alice), carol: 5 days, dave: 6 days (not joined)
  ('e0000000-0000-0000-0000-00000000000e', pg_temp.day(1), '{"name":"E","isCustom":false}', '[]', 'private'),
  ('e0000000-0000-0000-0000-00000000000e', pg_temp.day(3), '{"name":"E","isCustom":false}', '[]', 'private'),
  ('e0000000-0000-0000-0000-00000000000e', pg_temp.day(5), '{"name":"E","isCustom":false}', '[]', 'private'),
  ('c0000000-0000-0000-0000-00000000000c', pg_temp.day(0), '{"name":"C","isCustom":false}', '[]', 'followers'),
  ('c0000000-0000-0000-0000-00000000000c', pg_temp.day(1), '{"name":"C","isCustom":false}', '[]', 'followers'),
  ('c0000000-0000-0000-0000-00000000000c', pg_temp.day(2), '{"name":"C","isCustom":false}', '[]', 'followers'),
  ('c0000000-0000-0000-0000-00000000000c', pg_temp.day(3), '{"name":"C","isCustom":false}', '[]', 'followers'),
  ('c0000000-0000-0000-0000-00000000000c', pg_temp.day(4), '{"name":"C","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(0), '{"name":"D","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(1), '{"name":"D","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(2), '{"name":"D","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(3), '{"name":"D","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(4), '{"name":"D","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(5), '{"name":"D","isCustom":false}', '[]', 'followers');

-- the table is closed
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select * from public.leaderboard_members$q$, 'authenticated cannot select the table');
select pg_temp.expect_fail($q$insert into public.leaderboard_members (user_id) values ('a0000000-0000-0000-0000-00000000000a')$q$, 'cannot insert directly');
select pg_temp.expect_fail($q$delete from public.leaderboard_members$q$, 'cannot delete directly');

-- you must join to see the board
do $$ begin
  assert not public.am_i_on_leaderboard(), 'not on the board yet';
  assert (select count(*) from public.get_weekly_leaderboard()) = 0, 'a non-member sees an empty board';
end $$;

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b'); select public.join_leaderboard(); select public.join_leaderboard();   -- joining twice is fine
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c'); select public.join_leaderboard();
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e'); select public.join_leaderboard();
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.expect_fail_msg($q$select public.join_leaderboard()$q$, 'username_required', 'no username, no board');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.join_leaderboard();
do $$ begin
  assert public.am_i_on_leaderboard(), 'now on the board';
end $$;

-- the board: me + friends who joined; not strangers or one-way followers; not friends who did not join
do $$ begin
  assert (select array_agg(username) from public.get_weekly_leaderboard()) = array['bob_lifts', 'alice_lifts', 'erin_lifts'],
    'friends who joined, most days first, ties by username (alice and erin both have 3)';
  assert (select array_agg(days) from public.get_weekly_leaderboard()) = array[4, 3, 3], 'distinct days: two workouts on one day count once; last week and next week do not count; private workouts count for members';
  assert (select is_me from public.get_weekly_leaderboard() where username = 'alice_lifts'), 'I am flagged';
  assert not exists (select 1 from public.get_weekly_leaderboard() where username in ('carol_lifts', 'dave_lifts')), 'one-way followers and non-members are not on my board';
end $$;
-- carol (a one-way follower who joined) sees only herself: she has no friends
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select array_agg(username) from public.get_weekly_leaderboard()) = array['carol_lifts'], 'a member with no friends sees only themselves';
  assert (select days from public.get_weekly_leaderboard()) = 5, 'with her own count';
end $$;

-- leaving
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select public.leave_leaderboard(); select public.leave_leaderboard();
do $$ begin
  assert (select count(*) from public.get_weekly_leaderboard()) = 0, 'leaving empties my view';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_weekly_leaderboard()) = array['bob_lifts', 'alice_lifts'], 'and removes me from friends'' boards';
end $$;

-- blocks
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.blocks (blocker_id, blocked_id) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a');
select pg_temp.as_admin();
alter table public.follows disable trigger follows_guard_trigger;
insert into public.follows (follower_id, followee_id, status) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted'), ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted') on conflict do nothing;
alter table public.follows enable trigger follows_guard_trigger;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_weekly_leaderboard()) = array['alice_lifts'], 'a blocked friend disappears even if the follows were restored';
end $$;

-- the board is capped at 25 rows
select pg_temp.as_admin();
insert into auth.users (id, email)
select ('90000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 't_m' || g || '@berkeley.edu' from generate_series(1, 30) g;
update public.profiles p set username = 'member_' || split_part(substr(u.email, 4), '@', 1), terms_version = 'test'
from auth.users u where u.id = p.id and u.email like 't\_m%' and u.email not like 't\_member%';
insert into public.leaderboard_members (user_id)
select p.id from public.profiles p where p.username like 'member\_%';
alter table public.follows disable trigger follows_guard_trigger;
insert into public.follows (follower_id, followee_id, status)
select 'a0000000-0000-0000-0000-00000000000a', p.id, 'accepted' from public.profiles p where p.username like 'member\_%'
union all
select p.id, 'a0000000-0000-0000-0000-00000000000a', 'accepted' from public.profiles p where p.username like 'member\_%';
alter table public.follows enable trigger follows_guard_trigger;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_weekly_leaderboard()) = 25, 'the board is capped at 25 rows';
end $$;

-- account deletion
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.leaderboard_members where user_id = 'c0000000-0000-0000-0000-00000000000c') = 0, 'deleting an account removes its membership';
end $$;

-- anon
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.leaderboard_members$q$, 'permission denied', 'anon cannot read the table');
select pg_temp.expect_fail_msg($q$select public.join_leaderboard()$q$, 'permission denied', 'anon cannot join');
select pg_temp.expect_fail_msg($q$select public.leave_leaderboard()$q$, 'permission denied', 'anon cannot leave');
select pg_temp.expect_fail_msg($q$select public.am_i_on_leaderboard()$q$, 'permission denied', 'anon cannot ask');
select pg_temp.expect_fail_msg($q$select * from public.get_weekly_leaderboard()$q$, 'permission denied', 'anon cannot read the board');

select pg_temp.as_admin();
rollback;
