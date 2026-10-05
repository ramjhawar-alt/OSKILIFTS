-- 003 profiles/usernames tests. Safe to run in the Supabase SQL editor:
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

-- Statement must affect exactly n rows (RLS hides rows silently on UPDATE/DELETE).
create function pg_temp.expect_rows(q text, n int, label text) returns void language plpgsql as $$
declare got int;
begin
  execute q;
  get diagnostics got = row_count;
  if got <> n then raise exception 'EXPECTED % ROWS, GOT %: %', n, got, label; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'),
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu');
-- A test-only abuse term so this file never needs real slurs.
insert into public.blocked_terms (term, kind) values ('zzbadword', 'abuse');

-- ---------------------------------------------------------------------------
-- username format
-- ---------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$update public.profiles set username = 'ab' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'too short');
select pg_temp.expect_fail($q$update public.profiles set username = 'Alice' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'uppercase');
select pg_temp.expect_fail($q$update public.profiles set username = 'has space' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'space');
select pg_temp.expect_fail($q$update public.profiles set username = 'abcdefghijklmnopqrstu' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, '21 chars');
select pg_temp.expect_fail($q$update public.profiles set display_name = '' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'empty display name');

-- reserved + abuse filter (incl. leetspeak and separators)
select pg_temp.expect_fail($q$update public.profiles set username = 'admin' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'reserved: admin');
select pg_temp.expect_fail($q$update public.profiles set username = 'o_ski' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'reserved after normalization: o_ski');
select pg_temp.expect_fail($q$update public.profiles set username = '0skilifts' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'reserved via leetspeak: 0skilifts');
select pg_temp.expect_fail($q$update public.profiles set username = 'xzzbadword9' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'abuse substring');
select pg_temp.expect_fail($q$update public.profiles set username = 'zzb4dw0rd' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'abuse via leetspeak');
select pg_temp.expect_fail($q$update public.profiles set username = 'z_z_badword' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'abuse across separators');
select pg_temp.expect_fail($q$update public.profiles set display_name = 'ZZ Bad-Word' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'abuse in display name');
-- reserved words are fine inside longer names, and display names may be reserved words
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows($q$update public.profiles set username = 'admin_fan' where id = 'c0000000-0000-0000-0000-00000000000c'$q$, 1, 'reserved word inside a longer username is allowed');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------------------
-- claiming, uniqueness, immutability, terms
-- ---------------------------------------------------------------------------
select pg_temp.expect_rows(
  $q$update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = '2026-10'
     where id = 'a0000000-0000-0000-0000-00000000000a' and username is null$q$, 1, 'alice claims a username');

do $$ declare r record; begin
  select * into r from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a';
  assert r.username = 'alice_lifts', 'username stored';
  assert r.terms_accepted_at is not null, 'terms_accepted_at stamped by trigger';
end $$;

select pg_temp.expect_fail($q$update public.profiles set username = 'alice_two' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'username is immutable once set');
select pg_temp.expect_fail($q$update public.profiles set terms_accepted_at = '2000-01-01' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'terms_accepted_at is not client-writable');
select pg_temp.expect_fail($q$update public.profiles set id = gen_random_uuid() where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'id is not updatable');
select pg_temp.expect_fail($q$update public.profiles set created_at = now() where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'created_at is not updatable');
select pg_temp.expect_fail($q$insert into public.profiles (id, username) values (gen_random_uuid(), 'sneaky_one')$q$, 'clients cannot insert profiles');
select pg_temp.expect_fail($q$delete from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 'clients cannot delete profiles');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$update public.profiles set username = 'alice_lifts' where id = 'b0000000-0000-0000-0000-00000000000b'$q$, 'username must be unique');
select pg_temp.expect_rows($q$update public.profiles set display_name = 'hacked' where id = 'a0000000-0000-0000-0000-00000000000a'$q$, 0, 'bob cannot edit alice''s profile');
select pg_temp.expect_rows($q$update public.profiles set username = 'bob_lifts' where id = 'b0000000-0000-0000-0000-00000000000b'$q$, 1, 'bob claims a username');

-- ---------------------------------------------------------------------------
-- visibility of profiles and internals
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.profiles where username = 'alice_lifts') = 1,
    'any signed-in user can read other profiles';
end $$;
select pg_temp.expect_fail($q$select * from public.blocked_terms$q$, 'authenticated cannot read blocked_terms');
select pg_temp.expect_fail($q$select private.is_username_allowed('x')$q$, 'authenticated cannot call the name filter directly');

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.profiles$q$, 'anon cannot read profiles');
select pg_temp.expect_fail($q$select * from public.blocked_terms$q$, 'anon cannot read blocked_terms');

select pg_temp.as_admin();
rollback;
