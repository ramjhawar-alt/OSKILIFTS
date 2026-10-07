-- Basketball check-in tests (visibility regardless of account privacy, blocks, friends toggle, expiry). Safe to run in the Supabase SQL editor:
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
-- Fixtures. alice (a) is PRIVATE; bob (b) is PUBLIC and alice's friend (mutual);
-- carol (c) is a stranger to alice; dave (d) blocks alice later;
-- erin (e) is a friend of alice who stays checked out; nameless (f) has no username.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'), ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'), ('f0000000-0000-0000-0000-00000000000f', 't_nameless@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test', is_public = true where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  display_name = 'Erin',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
insert into public.follows (follower_id, followee_id, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted'), ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted');

-- ---------------------------------------------------------------------------
-- the table is closed
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select * from public.hoopers_checkins$q$, 'authenticated cannot select the table');
select pg_temp.expect_fail($q$insert into public.hoopers_checkins (user_id, expires_at) values ('b0000000-0000-0000-0000-00000000000b', now() + interval '1 hour')$q$, 'cannot insert directly');
select pg_temp.expect_fail($q$delete from public.hoopers_checkins$q$, 'cannot delete directly');

-- ---------------------------------------------------------------------------
-- checking in
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ declare e timestamptz; begin
  assert public.get_my_hoopers_checkin() is null, 'not checked in yet';
  e := public.hoopers_check_in();
  assert e > now() + interval '59 minutes' and e < now() + interval '61 minutes', 'a check-in lasts 60 minutes';
  assert public.get_my_hoopers_checkin() = e, 'and I can read my own';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.hoopers_check_in();
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.hoopers_check_in();
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.hoopers_check_in();
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.expect_fail_msg($q$select public.hoopers_check_in()$q$, 'username_required', 'a profile without a username cannot check in');

-- ---------------------------------------------------------------------------
-- the list: private accounts ARE listed (checking in is the consent)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select array_agg(username order by username) from public.get_hoopers()) = array['alice_lifts', 'bob_lifts', 'dave_lifts'],
    'a stranger sees everyone who checked in, including a private account';
  assert not exists (select 1 from public.get_hoopers() where username = 'carol_lifts'), 'never includes me';
  assert (select count(*) from public.get_hoopers() where is_friend) = 0, 'no friends';
  assert public.get_hoopers_count() = 4, 'the count includes me';
end $$;

-- friends first, and the friends toggle (bob checked in EARLIER than the others, so only the friend rule can put him first)
select pg_temp.as_admin();
update public.hoopers_checkins set checked_in_at = now() - interval '20 minutes' where user_id = 'b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_hoopers())[1] = 'bob_lifts', 'friends are listed first';
  assert (select is_friend from public.get_hoopers() where username = 'bob_lifts'), 'bob is flagged as a friend';
  assert not (select is_friend from public.get_hoopers() where username = 'carol_lifts'), 'carol is not';
  assert (select array_agg(username) from public.get_hoopers(true)) = array['bob_lifts'], 'friends-only shows mutual follows who are checked in (erin is not checked in)';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select array_agg(username) from public.get_hoopers(true)) = array['alice_lifts'], 'friendship is mutual';
end $$;

-- ---------------------------------------------------------------------------
-- blocks hide people from each other's lists, but not from the crowd count
-- ---------------------------------------------------------------------------
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
insert into public.blocks (blocker_id, blocked_id) values ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.get_hoopers() where username = 'alice_lifts'), 'someone I blocked is hidden from my list';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.get_hoopers() where username = 'dave_lifts'), 'someone who blocked me is hidden from my list';
  assert public.get_hoopers_count() = 4, 'but the crowd count still includes them';
end $$;

-- ---------------------------------------------------------------------------
-- expiry, checking out, restarting
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
update public.hoopers_checkins set checked_in_at = now() - interval '90 minutes', expires_at = now() - interval '1 minute' where user_id = 'c0000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.get_hoopers() where username = 'carol_lifts'), 'an expired check-in disappears from the list';
  assert public.get_hoopers_count() = 3, 'and from the count';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert public.get_my_hoopers_checkin() is null, 'and from my own status';
end $$;
select public.hoopers_check_in();
select public.hoopers_check_in();   -- again: extends, still one row
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.hoopers_checkins where user_id = 'c0000000-0000-0000-0000-00000000000c') = 1, 'one row per person';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.hoopers_check_out();
select public.hoopers_check_out();  -- nothing to remove is fine
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.get_hoopers() where username = 'carol_lifts'), 'checking out removes me';
end $$;

select pg_temp.as_admin();
select pg_temp.expect_fail($q$insert into public.hoopers_checkins (user_id, checked_in_at, expires_at) values ('e0000000-0000-0000-0000-00000000000e', now(), now() + interval '3 hours')$q$, '2 hour CHECK');

-- ---------------------------------------------------------------------------
-- the list is capped at 100
-- ---------------------------------------------------------------------------
insert into auth.users (id, email)
select ('90000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 't_p' || g || '@berkeley.edu' from generate_series(1, 120) g;
update public.profiles p set username = 'pl_' || split_part(substr(u.email, 4), '@', 1), terms_version = 'test'
from auth.users u where u.id = p.id and u.email like 't\_p%' and u.email not like 't\_pl%';
insert into public.hoopers_checkins (user_id, checked_in_at, expires_at)
select p.id, now() - interval '5 minutes', now() + interval '50 minutes'
from public.profiles p join auth.users u on u.id = p.id where u.email like 't\_p%@berkeley.edu' and p.username like 'pl\_%';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_hoopers()) = 100, 'the list is capped at 100';
  assert public.get_hoopers_count() >= 120, 'the count is not capped';
end $$;

-- ---------------------------------------------------------------------------
-- account deletion removes the check-in
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.hoopers_checkins where user_id = 'b0000000-0000-0000-0000-00000000000b') = 0, 'deleting an account removes its check-in';
end $$;

-- ---------------------------------------------------------------------------
-- anon can touch none of it
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.hoopers_checkins$q$, 'permission denied', 'anon cannot read the table');
select pg_temp.expect_fail_msg($q$select public.hoopers_check_in()$q$, 'permission denied', 'anon cannot check in');
select pg_temp.expect_fail_msg($q$select public.hoopers_check_out()$q$, 'permission denied', 'anon cannot check out');
select pg_temp.expect_fail_msg($q$select public.get_my_hoopers_checkin()$q$, 'permission denied', 'anon cannot read mine');
select pg_temp.expect_fail_msg($q$select * from public.get_hoopers()$q$, 'permission denied', 'anon cannot list');
select pg_temp.expect_fail_msg($q$select public.get_hoopers_count()$q$, 'permission denied', 'anon cannot count');

select pg_temp.as_admin();
rollback;
