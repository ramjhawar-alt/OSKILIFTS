-- "Heading to the RSF" tests (friends-only visibility, expiry, limits). Safe to run in the Supabase SQL editor:
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
-- Fixtures. alice (a):
--   bob (b)    mutual accepted follows        -> friend
--   carol (c)  follows alice, alice does not  -> NOT a friend
--   dave (d)   follows alice; alice's request to dave is pending -> NOT a friend
--   erin (e)   mutual follows, then blocks alice -> NOT a friend
--   nameless (f) mutual follows but no username  -> can't set a status
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'),
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'), ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),
  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'),  ('f0000000-0000-0000-0000-00000000000f', 't_nameless@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  display_name = 'Erin',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';

insert into public.follows (follower_id, followee_id, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted'), ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'accepted'), ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'pending'),
  ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('a0000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000000f', 'accepted'), ('f0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-00000000000a', 'accepted');

-- ---------------------------------------------------------------------------
-- the friends helper
-- ---------------------------------------------------------------------------
do $$ begin
  assert private.are_friends('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b'), 'mutual accepted follows are friends';
  assert private.are_friends('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a'), 'symmetric';
  assert not private.are_friends('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c'), 'a one-way follower is not a friend';
  assert not private.are_friends('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a'), 'neither is the person they follow';
  assert not private.are_friends('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000d'), 'a pending request is not a friendship';
  assert not private.are_friends('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a'), 'nobody is their own friend';
  assert not private.are_friends('a0000000-0000-0000-0000-00000000000a', null), 'null is not a friend';
end $$;

-- ---------------------------------------------------------------------------
-- the table is closed
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select * from public.rsf_heading$q$, 'authenticated cannot select the table');
select pg_temp.expect_fail($q$insert into public.rsf_heading (user_id, expires_at) values ('b0000000-0000-0000-0000-00000000000b', now() + interval '1 hour')$q$, 'authenticated cannot insert directly');
select pg_temp.expect_fail($q$delete from public.rsf_heading$q$, 'authenticated cannot delete directly');

-- ---------------------------------------------------------------------------
-- setting a status
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ declare e timestamptz; begin
  e := public.set_heading();
  assert e > now() + interval '89 minutes' and e < now() + interval '91 minutes', 'default is 90 minutes';
  assert public.get_my_heading() = e, 'get_my_heading returns my expiry';
  e := public.set_heading(1);
  assert e > now() + interval '14 minutes' and e < now() + interval '16 minutes', 'minimum is 15 minutes';
  e := public.set_heading(100000);
  assert e > now() + interval '179 minutes' and e < now() + interval '181 minutes', 'maximum is 3 hours';
  e := public.set_heading(null);
  assert e > now() + interval '89 minutes', 'null falls back to the default';
end $$;
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.rsf_heading where user_id = 'a0000000-0000-0000-0000-00000000000a') = 1, 'restarting keeps one row per person';
end $$;

select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.expect_fail_msg($q$select public.set_heading(60)$q$, 'username_required', 'profile without a username');

-- ---------------------------------------------------------------------------
-- who can see it: friends only
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select array_agg(username) from public.get_friends_heading()) = array['alice_lifts'], 'a friend sees alice';
end $$;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.get_friends_heading()) = 0, 'a one-way follower sees nothing';
end $$;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.get_friends_heading()) = 0, 'a pending request sees nothing';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_friends_heading()) = 0, 'my own status is not in my friends list';
  assert public.get_my_heading() is not null, 'but I can read my own';
end $$;

-- two-way: bob heads over too, alice sees him (most recent first)
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.set_heading(45);
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username order by started_at desc) from public.get_friends_heading()) = array['bob_lifts'], 'alice sees bob';
end $$;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select public.set_heading(60);
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username order by username) from public.get_friends_heading()) = array['bob_lifts', 'erin_lifts'], 'erin is visible before the block';
end $$;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
insert into public.blocks (blocker_id, blocked_id) values ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a');
-- Blocking removes the follows; restore them so the block alone is under test.
select pg_temp.as_admin();
alter table public.follows disable trigger follows_guard_trigger;
insert into public.follows (follower_id, followee_id, status) values ('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'accepted'), ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted') on conflict do nothing;
alter table public.follows enable trigger follows_guard_trigger;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username) from public.get_friends_heading()) = array['bob_lifts'], 'a blocked person is hidden from the blocker''s friend';
  assert not private.are_friends('a0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000e'), 'a block ends the friendship';
end $$;

-- ---------------------------------------------------------------------------
-- expiry and clearing
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
update public.rsf_heading set started_at = now() - interval '2 hours', expires_at = now() - interval '1 minute' where user_id = 'b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_friends_heading()) = 0, 'an expired status disappears';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert public.get_my_heading() is null, 'and I no longer see my own';
end $$;
select public.set_heading(30);
select public.clear_heading();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.rsf_heading where user_id = 'b0000000-0000-0000-0000-00000000000b') = 0, 'clearing removes the row';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.clear_heading();  -- clearing when there is nothing is fine

-- the stored expiry can never be longer than 3 hours, even for the owner of the table
select pg_temp.as_admin();
select pg_temp.expect_fail($q$insert into public.rsf_heading (user_id, started_at, expires_at) values ('c0000000-0000-0000-0000-00000000000c', now(), now() + interval '4 hours')$q$, '3 hour CHECK');

-- ---------------------------------------------------------------------------
-- account deletion removes the status
-- ---------------------------------------------------------------------------
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select public.set_heading(60);
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.rsf_heading where user_id = 'c0000000-0000-0000-0000-00000000000c') = 0, 'deleting an account removes its status';
end $$;

-- ---------------------------------------------------------------------------
-- anon can touch none of it
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.rsf_heading$q$, 'permission denied', 'anon cannot read the table');
select pg_temp.expect_fail_msg($q$select public.set_heading(60)$q$, 'permission denied', 'anon cannot set');
select pg_temp.expect_fail_msg($q$select public.clear_heading()$q$, 'permission denied', 'anon cannot clear');
select pg_temp.expect_fail_msg($q$select public.get_my_heading()$q$, 'permission denied', 'anon cannot read mine');
select pg_temp.expect_fail_msg($q$select * from public.get_friends_heading()$q$, 'permission denied', 'anon cannot list friends');
select pg_temp.expect_fail_msg($q$select private.are_friends('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')$q$, 'permission denied', 'anon cannot call the helper');

select pg_temp.as_admin();
rollback;
