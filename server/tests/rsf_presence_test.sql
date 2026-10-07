-- "At the RSF" presence tests (friends-only, expiry, arrival ends heading, no coordinates stored). Safe to run in the Supabase SQL editor:
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
-- Fixtures. alice (a): bob (b) mutual friend; carol (c) follows alice one-way;
-- dave (d) pending only; erin (e) mutual but blocks alice; nameless (f) no username.
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
  ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'accepted'), ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'pending'),
  ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted');

-- the table is closed, and has nowhere to put a location
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select * from public.rsf_presence$q$, 'authenticated cannot select the table');
select pg_temp.expect_fail($q$insert into public.rsf_presence (user_id, expires_at) values ('b0000000-0000-0000-0000-00000000000b', now() + interval '1 hour')$q$, 'cannot insert directly');
select pg_temp.expect_fail($q$delete from public.rsf_presence$q$, 'cannot delete directly');
select pg_temp.as_admin();
do $$ begin
  assert (select array_agg(column_name::text order by column_name) from information_schema.columns
          where table_schema = 'public' and table_name = 'rsf_presence') = array['arrived_at', 'expires_at', 'user_id'],
    'rsf_presence stores no coordinates or any other data: only who, when, and until when';
end $$;

-- setting presence
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ declare e timestamptz; begin
  assert public.get_my_rsf_presence() is null, 'not marked yet';
  e := public.set_at_rsf();
  assert e > now() + interval '24 minutes' and e < now() + interval '26 minutes', 'lasts 25 minutes';
  assert public.get_my_rsf_presence() = e, 'I can read my own';
end $$;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.expect_fail_msg($q$select public.set_at_rsf()$q$, 'username_required', 'profile without a username');

-- arriving ends "heading to the RSF"
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.set_heading(60);
do $$ begin
  assert public.get_my_heading() is not null, 'bob is heading over';
end $$;
select public.set_at_rsf();
do $$ begin
  assert public.get_my_heading() is null, 'arriving clears the heading status';
end $$;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select public.set_at_rsf();
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.set_at_rsf();
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.set_at_rsf();

-- who can see it: friends only
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username order by username) from public.get_friends_at_rsf()) = array['bob_lifts', 'erin_lifts'], 'alice sees her friends, not one-way followers or pending requests';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.get_friends_at_rsf()) = 0, 'a one-way follower sees nobody';
end $$;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.get_friends_at_rsf()) = 0, 'a pending request sees nobody';
end $$;

-- arrival time survives refreshes (longest-there listed first)
select pg_temp.as_admin();
update public.rsf_presence set arrived_at = now() - interval '30 minutes', expires_at = now() + interval '5 minutes' where user_id = 'b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.set_at_rsf();   -- still there: refresh
select pg_temp.as_admin();
do $$ begin
  assert (select arrived_at from public.rsf_presence where user_id = 'b0000000-0000-0000-0000-00000000000b') < now() - interval '29 minutes', 'a refresh keeps the original arrival time';
  assert (select expires_at from public.rsf_presence where user_id = 'b0000000-0000-0000-0000-00000000000b') > now() + interval '24 minutes', 'and extends the expiry';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_friends_at_rsf())[1] = 'bob_lifts', 'longest-there first';
end $$;

-- a lapsed presence starts over
select pg_temp.as_admin();
update public.rsf_presence set arrived_at = now() - interval '2 hours', expires_at = now() - interval '1 minute' where user_id = 'b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_friends_at_rsf()) = array['erin_lifts'], 'an expired presence disappears';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert public.get_my_rsf_presence() is null, 'my own expired presence reads as none';
end $$;
select public.set_at_rsf();
select pg_temp.as_admin();
do $$ begin
  assert (select arrived_at from public.rsf_presence where user_id = 'b0000000-0000-0000-0000-00000000000b') > now() - interval '1 minute', 'coming back after a lapse is a new arrival';
end $$;

-- blocks
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
insert into public.blocks (blocker_id, blocked_id) values ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a');
select pg_temp.as_admin();
alter table public.follows disable trigger follows_guard_trigger;
insert into public.follows (follower_id, followee_id, status) values ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted') on conflict do nothing;
alter table public.follows enable trigger follows_guard_trigger;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_friends_at_rsf()) = array['bob_lifts'], 'a blocked person is hidden even if the follows were restored';
end $$;

-- leaving, and clearing when there is nothing to clear
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.clear_at_rsf();
select public.clear_at_rsf();
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_friends_at_rsf()) = 0, 'clearing removes me';
end $$;

select pg_temp.as_admin();
select pg_temp.expect_fail($q$insert into public.rsf_presence (user_id, arrived_at, expires_at) values ('f0000000-0000-0000-0000-00000000000f', now(), now() + interval '13 hours')$q$, '12 hour CHECK (nameless has no row yet, so only the CHECK can stop this)');

-- account deletion
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.set_at_rsf();
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.rsf_presence where user_id = 'c0000000-0000-0000-0000-00000000000c') = 0, 'deleting an account removes its presence';
end $$;

-- anon
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.rsf_presence$q$, 'permission denied', 'anon cannot read the table');
select pg_temp.expect_fail_msg($q$select public.set_at_rsf()$q$, 'permission denied', 'anon cannot set');
select pg_temp.expect_fail_msg($q$select public.clear_at_rsf()$q$, 'permission denied', 'anon cannot clear');
select pg_temp.expect_fail_msg($q$select public.get_my_rsf_presence()$q$, 'permission denied', 'anon cannot read mine');
select pg_temp.expect_fail_msg($q$select * from public.get_friends_at_rsf()$q$, 'permission denied', 'anon cannot list');

select pg_temp.as_admin();
rollback;
