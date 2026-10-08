-- Invite link and admin metrics tests. Safe to run in the Supabase SQL editor:
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
-- Fixtures. alice (a): old account, public. bob (b): new. carol (c): signed up 20 days ago.
-- dave (d): admin. erin (e): new, blocked with bob. nameless (f): no username.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'), ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'), ('f0000000-0000-0000-0000-00000000000f', 't_nameless@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test', is_public = true, created_at = now() - interval '60 days' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test', created_at = now() - interval '20 days' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_admin',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
insert into public.admins (user_id) values ('d0000000-0000-0000-0000-00000000000d');

-- ---------------------------------------------------------------------------
-- resolve_username
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select id from public.resolve_username('alice_lifts')) = 'a0000000-0000-0000-0000-00000000000a', 'finds a username';
  assert (select id from public.resolve_username('  ALICE_Lifts ')) = 'a0000000-0000-0000-0000-00000000000a', 'case and spaces do not matter';
  assert (select display_name from public.resolve_username('alice_lifts')) = 'Alice' and (select is_public from public.resolve_username('alice_lifts')), 'returns the public profile facts';
  assert not exists (select 1 from public.resolve_username('nobody_here')), 'unknown username: nothing';
  assert not exists (select 1 from public.resolve_username('alice')), 'exact matches only: a prefix finds nothing';
  assert not exists (select 1 from public.resolve_username('alice%')), 'wildcards are not special';
  assert not exists (select 1 from public.resolve_username(null)), 'null: nothing';
  assert not exists (select 1 from public.resolve_username('')), 'empty: nothing';
  assert (select id from public.resolve_username('bob_lifts')) = 'b0000000-0000-0000-0000-00000000000b', 'you can resolve yourself';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.blocks (blocker_id, blocked_id) values ('b0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert not exists (select 1 from public.resolve_username('erin_lifts')), 'someone I blocked cannot be resolved';
end $$;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert not exists (select 1 from public.resolve_username('bob_lifts')), 'and someone who blocked me cannot either';
end $$;
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.resolve_username('alice_lifts')$q$, 'permission denied', 'anon cannot resolve');

-- ---------------------------------------------------------------------------
-- record_invite
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select * from public.invites$q$, 'authenticated cannot read the table');
select pg_temp.expect_fail($q$insert into public.invites (invitee_id, inviter_id) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a')$q$, 'cannot insert directly');
do $$ begin
  assert public.record_invite('alice_lifts'), 'a new account can record who invited it';
  assert not public.record_invite('alice_lifts'), 'only once';
  assert not public.record_invite('carol_lifts'), 'and only one inviter per account';
  assert not public.record_invite('bob_lifts'), 'never yourself';
  assert not public.record_invite('nobody_here'), 'unknown inviter';
  assert not public.record_invite(null), 'null';
end $$;
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.invites) = 1 and (select inviter_id from public.invites where invitee_id = 'b0000000-0000-0000-0000-00000000000b') = 'a0000000-0000-0000-0000-00000000000a', 'exactly one row so far: alice invited bob';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not public.record_invite('bob_lifts'), 'an old account clicking a friend''s link is not a conversion';
end $$;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert not public.record_invite('bob_lifts'), 'never across a block';
end $$;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
do $$ begin
  assert not public.record_invite('alice_lifts'), 'an account without a username cannot record one';
end $$;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert public.record_invite('carol_lifts'), 'erin joined through carol';
end $$;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert public.record_invite('carol_lifts'), 'dave joined through carol too';
end $$;
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select public.record_invite('alice_lifts')$q$, 'permission denied', 'anon cannot record');

-- ---------------------------------------------------------------------------
-- admin_metrics: a world small enough to count by hand
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
create function pg_temp.day(k int) returns timestamptz language sql as $$
  select ((((now() at time zone 'America/Los_Angeles')::date + k) + time '12:00') at time zone 'UTC')
$$;
insert into public.workouts (user_id, date, day_type, exercises, visibility) values
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(0),   '{"name":"Push","isCustom":false}', '[]', 'followers'),
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(-2),  '{"name":"Pull","isCustom":false}', '[]', 'private'),
  ('a0000000-0000-0000-0000-00000000000a', pg_temp.day(-20), '{"name":"Legs","isCustom":false}', '[]', 'followers'),
  ('b0000000-0000-0000-0000-00000000000b', pg_temp.day(0),   '{"name":"Arms","isCustom":false}', '[]', 'followers'),
  ('c0000000-0000-0000-0000-00000000000c', pg_temp.day(-10), '{"name":"Back","isCustom":false}', '[]', 'followers'),
  ('d0000000-0000-0000-0000-00000000000d', pg_temp.day(-7),  '{"name":"Edge","isCustom":false}', '[]', 'followers');
insert into public.follows (follower_id, followee_id, status) values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'), ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'pending');
insert into public.leaderboard_members (user_id) values ('a0000000-0000-0000-0000-00000000000a'), ('b0000000-0000-0000-0000-00000000000b');
insert into public.user_goals (user_id, weekly_days) values ('a0000000-0000-0000-0000-00000000000a', 4);
insert into public.hoopers_checkins (user_id, checked_in_at, expires_at) values ('a0000000-0000-0000-0000-00000000000a', now(), now() + interval '30 minutes'), ('b0000000-0000-0000-0000-00000000000b', now() - interval '90 minutes', now() - interval '30 minutes');
insert into public.rsf_presence (user_id, expires_at) values ('b0000000-0000-0000-0000-00000000000b', now() + interval '10 minutes');
insert into public.email_preferences (user_id, weekly_digest) values ('a0000000-0000-0000-0000-00000000000a', true), ('b0000000-0000-0000-0000-00000000000b', false);
insert into public.reports (reporter_id, target_type, target_id, reported_user_id, reason, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'profile', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'spam', 'open'), ('c0000000-0000-0000-0000-00000000000c', 'profile', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'spam', 'dismissed');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail_msg($q$select public.admin_metrics()$q$, 'not_admin', 'non-admins are refused');
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select public.admin_metrics()$q$, 'permission denied', 'anon is refused');

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ declare m jsonb; begin
  m := public.admin_metrics(30);
  assert (m->>'days')::int = 30, 'thirty days';
  assert (m->'totals'->>'users')::int = 6, 'six users';
  assert (m->'totals'->>'onboarded')::int = 5, 'five chose a username (nameless did not)';
  assert (m->'totals'->>'public_accounts')::int = 1, 'one public account';
  assert (m->'totals'->>'workouts')::int = 6, 'six workouts';
  assert (m->'totals'->>'active_7d')::int = 2, 'alice and bob trained in the last 7 days (dave''s workout exactly 7 days ago is outside the window)';
  assert (m->'totals'->>'active_prev_7d')::int = 2, 'carol (10 days ago) and dave (exactly 7 days ago) trained in the week before';
  assert (m->'totals'->>'follows')::int = 1, 'one accepted follow (the pending one does not count)';
  assert (m->'totals'->>'open_reports')::int = 1, 'one open report';
  assert (m->'adoption'->>'leaderboard')::int = 2 and (m->'adoption'->>'weekly_recap')::int = 1 and (m->'adoption'->>'weekly_goals')::int = 1, 'adoption counts (recap counts only people who are ON)';
  assert (m->'adoption'->>'hoopers_now')::int = 1, 'only the unexpired check-in';
  assert (m->'adoption'->>'at_rsf_now')::int = 1 and (m->'adoption'->>'heading_now')::int = 0, 'presence now';
  -- funnel: signups in the last 30 days = bob, carol (20 days ago), dave, erin, nameless; alice is 60 days old
  assert (m->'funnel'->>'signups')::int = 5, 'five signed up in the window (alice is older)';
  assert (m->'funnel'->>'onboarded')::int = 4, 'four of them chose a username';
  assert (m->'funnel'->>'logged_workout')::int = 3, 'bob, carol and dave logged workouts';
  assert (m->'funnel'->>'followed_someone')::int = 2, 'bob (accepted) and carol (pending) both followed someone';
  assert (m->'funnel'->>'returned_after_week')::int = 1, 'carol trained 10 days after her signup 20 days ago; bob has had no time to return';
  assert (m->'invites'->>'total')::int = 3 and (m->'invites'->>'in_period')::int = 3, 'three invites recorded';
  assert m->'invites'->'top' = '[{"count": 2, "username": "carol_lifts"}, {"count": 1, "username": "alice_lifts"}]'::jsonb, 'inviters ranked by how many they brought, not alphabetically';
  assert jsonb_array_length(m->'daily') = 30, 'thirty daily rows, with empty days filled in';
  assert (m->'daily'->29->>'workouts')::int = 2 and (m->'daily'->29->>'active')::int = 2, 'today: two workouts by two people';
  assert (m->'daily'->29->>'signups')::int = 4, 'today: four signups (bob, dave, erin, nameless; carol is 20 days ago)';
  assert (m->'daily'->9->>'signups')::int = 1, 'carol''s signup 20 days ago is in its own bucket';
  assert (m->'daily'->0->>'signups')::int = 0, 'empty days are zero, not missing';
  assert jsonb_array_length(public.admin_metrics(1)->'daily') = 7, 'at least a week';
  assert jsonb_array_length(public.admin_metrics(500)->'daily') = 90, 'at most 90 days';
  assert jsonb_array_length(public.admin_metrics(null)->'daily') = 30, 'default 30';
  assert (public.admin_metrics(7)->'funnel'->>'signups')::int = 4, 'a shorter window excludes carol';
  assert position('@' in m::text) = 0, 'no email addresses anywhere in the document';
end $$;

-- ---------------------------------------------------------------------------
-- account deletion removes invites in both directions
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.invites) = 2 and not exists (select 1 from public.invites where inviter_id = 'a0000000-0000-0000-0000-00000000000a'), 'deleting the inviter removes only their records';
end $$;

-- the "top inviters" list shows at most five, biggest first, ties alphabetical
-- (carol has 2; seven new people have 1 each, with names that sort BEFORE carol's)
select pg_temp.as_admin();
insert into auth.users (id, email)
select ('92000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 't_top' || g || '@berkeley.edu' from generate_series(1, 14) g;
update public.profiles p
   set username = case when (right(p.id::text, 12))::int <= 7 then 'aaa_inv_' || (right(p.id::text, 12))::int
                        else 'aaa_new_' || (right(p.id::text, 12))::int end,
       terms_version = 'test'
 where p.id::text like '92000000%';
insert into public.invites (invitee_id, inviter_id)
select ('92000000-0000-0000-0000-' || lpad((g + 7)::text, 12, '0'))::uuid, ('92000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, 7) g;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ declare top jsonb; begin
  top := public.admin_metrics(30)->'invites'->'top';
  assert jsonb_array_length(top) = 5, 'at most five inviters are listed';
  assert top->0->>'username' = 'carol_lifts' and (top->0->>'count')::int = 2, 'the biggest inviter is first even though her name sorts last';
  assert (select array_agg(e->>'username') from jsonb_array_elements(top) e) = array['carol_lifts', 'aaa_inv_1', 'aaa_inv_2', 'aaa_inv_3', 'aaa_inv_4'], 'then ties in alphabetical order';
end $$;

rollback;
