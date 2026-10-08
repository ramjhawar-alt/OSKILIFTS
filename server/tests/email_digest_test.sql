-- Email digest tests (opt-in, what counts, windows, unsubscribe, admin alerts, server-only access). Safe to run in the Supabase SQL editor:
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

create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
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
-- Fixtures. alice (a) and bob (b) opt in; carol (c) never does; dave (d), erin (e),
-- frank (f) generate activity on alice's workout; gina (g) is the admin.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'), ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'), ('f0000000-0000-0000-0000-00000000000f', 't_frank@berkeley.edu'),
  ('90000000-0000-0000-0000-000000000009', 'ram_jhawar@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
update public.profiles set username = 'frank_lifts', terms_version = 'test' where id = 'f0000000-0000-0000-0000-00000000000f';
update public.profiles set username = 'gina_admin',  terms_version = 'test' where id = '90000000-0000-0000-0000-000000000009';
insert into public.admins (user_id) values ('90000000-0000-0000-0000-000000000009');

insert into public.workouts (id, user_id, date, day_type, exercises, notes, visibility) values
  ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]', 'private notes', 'followers');

-- ---------------------------------------------------------------------------
-- table and functions: who can call what
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail($q$select * from public.email_preferences$q$, 'authenticated cannot read the table');
select pg_temp.expect_fail($q$insert into public.email_preferences (user_id, weekly_digest) values ('c0000000-0000-0000-0000-00000000000c', true)$q$, 'cannot write the table directly');
select pg_temp.expect_fail_msg($q$select * from public.digest_candidates()$q$, 'permission denied', 'app users cannot list recipients');
select pg_temp.expect_fail_msg($q$select public.digest_mark_sent('a0000000-0000-0000-0000-00000000000a')$q$, 'permission denied', 'app users cannot mark sent');
select pg_temp.expect_fail_msg($q$select public.digest_unsubscribe(gen_random_uuid())$q$, 'permission denied', 'app users cannot unsubscribe others');
select pg_temp.expect_fail_msg($q$select * from public.admin_alert_candidates()$q$, 'permission denied', 'app users cannot read admin alerts');
select pg_temp.expect_fail_msg($q$select public.admin_alert_mark_sent()$q$, 'permission denied', 'app users cannot mark alerts sent');
select pg_temp.expect_fail_msg($q$select private.digest_payload('a0000000-0000-0000-0000-00000000000a', now() - interval '7 days')$q$, 'permission denied', 'the payload builder is private');
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.digest_candidates()$q$, 'permission denied', 'anon cannot list recipients');
select pg_temp.expect_fail_msg($q$select public.digest_unsubscribe(gen_random_uuid())$q$, 'permission denied', 'anon cannot unsubscribe');
select pg_temp.expect_fail_msg($q$select * from public.get_email_prefs()$q$, 'permission denied', 'anon cannot read prefs');
select pg_temp.expect_fail_msg($q$select public.set_weekly_digest(true)$q$, 'permission denied', 'anon cannot set prefs');

-- ---------------------------------------------------------------------------
-- my own setting
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert not (select weekly_digest from public.get_email_prefs()), 'off by default';
  assert not (select decided from public.get_email_prefs()), 'and not decided yet';
end $$;
select pg_temp.expect_fail_msg($q$select public.set_weekly_digest(null)$q$, 'invalid_value', 'null is not a choice');
select public.set_weekly_digest(false);
do $$ begin
  assert not (select weekly_digest from public.get_email_prefs()) and (select decided from public.get_email_prefs()), 'answering "no thanks" counts as decided';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a'); select public.set_weekly_digest(true);
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b'); select public.set_weekly_digest(true);
do $$ begin
  assert (select weekly_digest from public.get_email_prefs()), 'bob is on';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert not (select weekly_digest from public.get_email_prefs()), 'carol is still off: settings are per person';
end $$;

-- ---------------------------------------------------------------------------
-- activity on alice's workout
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
-- dave follows (a new follower), erin follows and is later blocked, frank only requests,
-- an old follower from 10 days ago is outside the window
insert into public.follows (follower_id, followee_id, status, created_at) values
  ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '1 day'),
  ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '1 day'),
  ('f0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-00000000000a', 'pending',  now() - interval '1 day'),
  ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '10 days');
insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-00000000000d'), ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a');
insert into public.workout_comments (workout_id, user_id, body) values
  ('e1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-00000000000d', 'private note text that must never reach an email'), ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'my own comment'), ('e1000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-00000000000e', 'from erin');
-- alice blocks erin (the trigger removes the follow; put it back so only the block filter is tested)
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e');
alter table public.follows disable trigger follows_guard_trigger;
insert into public.follows (follower_id, followee_id, status, created_at) values ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '1 day') on conflict do nothing;
alter table public.follows enable trigger follows_guard_trigger;
-- a like from the blocked erin, added after the block (blocking itself deletes earlier likes between a pair)
insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-00000000000e');
-- three MORE new followers, so there are four in total and the names are capped at three, newest first
insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 't_h1@berkeley.edu'), ('91000000-0000-0000-0000-000000000002', 't_h2@berkeley.edu'), ('91000000-0000-0000-0000-000000000003', 't_h3@berkeley.edu');
update public.profiles set username = 'extra_' || right(id::text, 1), terms_version = 'test' where id::text like '91000000%';
insert into public.follows (follower_id, followee_id, status, created_at) values
  ('91000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '3 hours'),
  ('91000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '2 hours'),
  ('91000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '1 hour');
-- two different training days in the last week for alice, plus a goal
insert into public.workouts (user_id, date, day_type, exercises, visibility) values
  ('a0000000-0000-0000-0000-00000000000a', now() - interval '1 day', '{"name":"Pull","isCustom":false}', '[]', 'private');
insert into public.user_goals (user_id, weekly_days) values ('a0000000-0000-0000-0000-00000000000a', 4);

select pg_temp.as_service();
do $$ declare r record; begin
  select * into r from public.digest_candidates() where username = 'alice_lifts';
  assert r.user_id = 'a0000000-0000-0000-0000-00000000000a' and r.email = 't_alice@berkeley.edu', 'alice is due a recap, to her own address';
  assert r.unsubscribe_token is not null, 'with an unsubscribe token';
  assert (r.payload->>'new_followers')::int = 4, 'four new followers: dave and three more (the 10-day-old follow is outside the window, erin is blocked)';
  assert r.payload->'follower_names' = '["extra_3", "extra_2", "extra_1"]'::jsonb, 'named: at most three, newest first (dave is the oldest of the four and drops off)';
  assert (r.payload->>'pending_requests')::int = 1, 'one waiting request: frank';
  assert (r.payload->>'likes')::int = 1, 'one like: dave (her own like and the blocked erin do not count)';
  assert (r.payload->>'comments')::int = 1, 'one comment: dave (her own and the blocked erin do not count)';
  assert (r.payload->>'days_trained')::int = 2, 'two different days trained in the last week';
  assert (r.payload->>'weekly_goal')::int = 4, 'and her goal';
  assert position('private note' in r.payload::text) = 0 and position('Push' in r.payload::text) = 0, 'the payload holds counts and names only: no comment text, notes or workout details';
  assert not exists (select 1 from public.digest_candidates() where username in ('bob_lifts', 'carol_lifts')), 'bob has no activity and carol did not opt in';
  assert (select count(*) from public.digest_candidates()) = 1, 'only alice';
  assert (select count(*) from public.digest_candidates(1)) = 1, 'limit respected';
end $$;

-- a waiting follow request on its own is enough to be worth a recap (bob has no other activity)
select pg_temp.as_admin();
insert into public.follows (follower_id, followee_id, status) values ('f0000000-0000-0000-0000-00000000000f', 'b0000000-0000-0000-0000-00000000000b', 'pending');
select pg_temp.as_service();
do $$ begin
  assert exists (select 1 from public.digest_candidates() where username = 'bob_lifts' and (payload->>'pending_requests')::int = 1), 'a pending request alone makes bob due';
end $$;
select pg_temp.as_admin();
delete from public.follows where follower_id = 'f0000000-0000-0000-0000-00000000000f' and followee_id = 'b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_service();

-- sending: marking sent removes her until the next week
select public.digest_mark_sent('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.digest_candidates() where username = 'alice_lifts'), 'emailed within 6 days: not due again';
end $$;
select pg_temp.as_admin();
do $$ begin
  assert (select last_digest_at from public.email_preferences where user_id = 'a0000000-0000-0000-0000-00000000000a') > now() - interval '1 minute', 'the send time is recorded';
  assert (select last_digest_at from public.email_preferences where user_id = 'b0000000-0000-0000-0000-00000000000b') is null, 'and only for the person emailed (bob was not)';
end $$;
-- seven days later, with new activity inside the new window only
update public.email_preferences set last_digest_at = now() - interval '7 days' where user_id = 'a0000000-0000-0000-0000-00000000000a';
update public.follows set created_at = now() - interval '8 days' where follower_id = 'd0000000-0000-0000-0000-00000000000d';   -- before the window now
select pg_temp.as_service();
do $$ declare r record; begin
  select * into r from public.digest_candidates() where username = 'alice_lifts';
  assert r.user_id = 'a0000000-0000-0000-0000-00000000000a', 'due again after a week (pending request and likes still count)';
  assert (r.payload->>'new_followers')::int = 3, 'dave''s follow is now older than the last recap so it is not new again (the three recent ones are)';
end $$;
select pg_temp.as_admin();
-- with nothing new at all there is no email
delete from public.follows where followee_id = 'a0000000-0000-0000-0000-00000000000a' and (status = 'pending' or follower_id::text like '91000000%');
delete from public.workout_likes where workout_id = 'e1000000-0000-0000-0000-0000000000e1';
delete from public.workout_comments where workout_id = 'e1000000-0000-0000-0000-0000000000e1';
select pg_temp.as_service();
do $$ begin
  assert (select count(*) from public.digest_candidates()) = 0, 'no activity, no email';
end $$;
-- turning it off stops everything
select pg_temp.as_admin();
insert into public.workout_likes (workout_id, user_id) values ('e1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-00000000000d');
select pg_temp.as_service();
do $$ begin
  assert (select count(*) from public.digest_candidates()) = 1, 'a new like makes her due';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a'); select public.set_weekly_digest(false);
select pg_temp.as_service();
do $$ begin
  assert (select count(*) from public.digest_candidates()) = 0, 'opted out: never emailed';
end $$;

-- ---------------------------------------------------------------------------
-- one-click unsubscribe
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
update public.email_preferences set weekly_digest = true where user_id in ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c');
do $$ declare tok uuid; tok_carol uuid; begin
  select unsubscribe_token into tok from public.email_preferences where user_id = 'b0000000-0000-0000-0000-00000000000b';
  select unsubscribe_token into tok_carol from public.email_preferences where user_id = 'c0000000-0000-0000-0000-00000000000c';
  perform pg_temp.as_service();
  assert public.digest_unsubscribe(tok), 'a valid token unsubscribes';
  assert not public.digest_unsubscribe(tok), 'a second use does nothing';
  assert not public.digest_unsubscribe(gen_random_uuid()), 'an unknown token does nothing';
  assert not public.digest_unsubscribe(null), 'null does nothing';
  perform pg_temp.as_admin();
  assert not (select weekly_digest from public.email_preferences where user_id = 'b0000000-0000-0000-0000-00000000000b'), 'bob is off';
  assert (select weekly_digest from public.email_preferences where user_id = 'c0000000-0000-0000-0000-00000000000c'), 'and carol, who is still subscribed, was not affected by bob''s token';
  assert tok <> tok_carol, 'tokens are unique per person';
end $$;

-- ---------------------------------------------------------------------------
-- admin alerts
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
do $$ begin
  assert (select count(*) from public.admin_alert_candidates()) = 0, 'no open reports, no alert';
end $$;
select pg_temp.as_admin();
insert into public.reports (reporter_id, target_type, target_id, reported_user_id, reason, status, created_at) values
  ('c0000000-0000-0000-0000-00000000000c', 'workout', 'e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'spam', 'open', now() - interval '5 hours'),
  ('d0000000-0000-0000-0000-00000000000d', 'profile', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'other', 'open', now() - interval '1 hour'),
  ('f0000000-0000-0000-0000-00000000000f', 'profile', 'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'other', 'dismissed', now() - interval '1 hour');
select pg_temp.as_service();
do $$ declare r record; begin
  select * into r from public.admin_alert_candidates();
  assert r.email = 'ram_jhawar@berkeley.edu' and r.open_count = 2, 'the admin is told about the two OPEN reports';
  assert r.oldest_open < now() - interval '4 hours', 'with the age of the oldest';
  assert (select count(*) from public.admin_alert_candidates()) = 1, 'one row per admin';
end $$;
select public.admin_alert_mark_sent();
do $$ begin
  assert (select count(*) from public.admin_alert_candidates()) = 0, 'at most one alert per day';
end $$;
select pg_temp.as_admin();
update public.admins set last_alerted_at = now() - interval '24 hours';
select pg_temp.as_service();
do $$ begin
  assert (select count(*) from public.admin_alert_candidates()) = 1, 'and again after a day if reports are still open';
end $$;
select pg_temp.as_admin();
update public.reports set status = 'actioned' where status = 'open';
select pg_temp.as_service();
do $$ begin
  assert (select count(*) from public.admin_alert_candidates()) = 0, 'resolved reports stop the alerts';
end $$;

-- ---------------------------------------------------------------------------
-- account deletion removes the preferences
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.email_preferences where user_id = 'a0000000-0000-0000-0000-00000000000a') = 0, 'deleting an account removes its email settings';
end $$;

rollback;
