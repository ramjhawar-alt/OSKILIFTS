-- Followers/following list tests (get_connections). Safe to run in the Supabase SQL editor:
-- Everything happens in a transaction that ends in ROLLBACK.
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
-- Fixtures: alice (a), bob (b), carol (c), dave (d), erin (e), nameless (f)
--   followers of alice: bob, carol (accepted); erin (pending); nameless (accepted, no username)
--   alice follows: dave (accepted)
--   bob follows carol (pending)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'),
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),
  ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu'),
  ('f0000000-0000-0000-0000-00000000000f', 't_nameless@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  display_name = 'Erin',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';

insert into public.follows (follower_id, followee_id, status, created_at) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now() - interval '2 days'),
  ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'pending',  now() - interval '1 day'),
  ('f0000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-00000000000a', 'accepted', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'accepted', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c', 'pending',  now());

-- ---------------------------------------------------------------------------
-- my own lists
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select array_agg(username order by created_at desc) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers'))
    = array['carol_lifts', 'bob_lifts'], 'own followers: accepted + named only, newest first (no pending, no nameless)';
  assert (select array_agg(username) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'following'))
    = array['dave_lifts'], 'own following';
  assert (select relationship from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'following')) = 'following',
    'relationship to a person I follow';
  assert (select relationship from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers') where username = 'bob_lifts') = 'none',
    'relationship to a follower I do not follow back';
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'bogus')) = 0, 'unknown kind returns nothing';
  assert (select count(*) from public.get_connections(null, 'followers')) = 0, 'null user returns nothing';
end $$;

-- ---------------------------------------------------------------------------
-- an accepted follower can read the list; everyone else gets nothing
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select array_agg(username order by created_at desc) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers'))
    = array['carol_lifts', 'bob_lifts'], 'accepted follower sees alice''s followers';
  assert (select relationship from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers') where username = 'bob_lifts') = 'self',
    'I appear as self in the list';
  assert (select relationship from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers') where username = 'carol_lifts') = 'pending_out',
    'relationship reflects my pending request to carol';
  assert (select array_agg(username) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'following')) = array['dave_lifts'],
    'accepted follower sees who alice follows';
end $$;

select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = 0, 'pending follower sees nothing';
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'following')) = 0, 'pending follower sees nothing (following)';
end $$;

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  -- alice follows dave, but dave does not follow alice: that is not access.
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = 0, 'someone alice follows (but who does not follow alice) sees nothing';
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'following')) = 0, 'same for following';
  assert (select count(*) from public.get_connections('b0000000-0000-0000-0000-00000000000b', 'following')) = 0, 'strangers see nothing';
end $$;

-- ---------------------------------------------------------------------------
-- blocks hide people (either direction) and shut out the blocked caller
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.blocks (blocker_id, blocked_id) values ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select array_agg(username) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = array['bob_lifts'],
    'someone I blocked is hidden from lists';
end $$;

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select array_agg(username) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = array['carol_lifts'],
    'someone who blocked me is hidden from lists (carol sees herself only)';
end $$;

-- The profile owner blocks bob. Blocking may remove the follow, so re-insert it as
-- admin to prove the block alone shuts bob out of alice's lists.
select pg_temp.as_admin();
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')
  on conflict do nothing;
alter table public.follows disable trigger follows_guard_trigger;
insert into public.follows (follower_id, followee_id, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted');
alter table public.follows enable trigger follows_guard_trigger;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')) = 0, 'a user who blocked me shows me nothing';
end $$;

-- ---------------------------------------------------------------------------
-- keyset pagination: 120 followers of dave, walked in pages with the cursor
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
insert into auth.users (id, email)
select ('90000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 't_page' || g || '@berkeley.edu'
from generate_series(1, 120) g;
update public.profiles p set username = 'page_' || split_part(substr(u.email, 7), '@', 1), terms_version = 'test'
from auth.users u where u.id = p.id and u.email like 't\_page%';
-- Several rows share a timestamp so the id tie-breaker is exercised.
insert into public.follows (follower_id, followee_id, status, created_at)
select p.id, 'd0000000-0000-0000-0000-00000000000d', 'accepted',
       timestamptz '2026-01-01 00:00:00+00' + ((row_number() over (order by p.id) - 1) / 3) * interval '1 minute'
from public.profiles p join auth.users u on u.id = p.id where u.email like 't\_page%';

select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$
declare
  seen int := 0;
  pages int := 0;
  cur_at timestamptz := null;
  cur_id uuid := null;
  n int;
begin
  loop
    select count(*), (array_agg(created_at order by created_at, id))[1], (array_agg(id order by created_at, id))[1]
      into n, cur_at, cur_id
    from public.get_connections('d0000000-0000-0000-0000-00000000000d', 'followers', 50, cur_at, cur_id);
    exit when n = 0;
    seen := seen + n;
    pages := pages + 1;
    assert pages < 10, 'pagination must terminate';
  end loop;
  -- 120 page followers + alice, who also follows dave
  assert seen = 121, format('pagination visits every follower exactly once, saw %s', seen);
  assert pages = 3, format('50 + 50 + 21 rows, got %s pages', pages);
  assert (select count(*) from public.get_connections('d0000000-0000-0000-0000-00000000000d', 'followers', 1000)) = 100, 'limit is capped at 100';
  assert (select count(*) from public.get_connections('d0000000-0000-0000-0000-00000000000d', 'followers', 0)) = 1, 'limit floors at 1';
end $$;

-- ---------------------------------------------------------------------------
-- anon can touch none of it
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.get_connections('a0000000-0000-0000-0000-00000000000a', 'followers')$q$, 'anon cannot call get_connections');

select pg_temp.as_admin();
rollback;
