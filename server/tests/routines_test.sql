-- Routines (migration 007): isolation, limits, immutability, cap, cascade. Safe to run in the Supabase SQL editor:
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

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu');

-- a minimal valid exercises payload
create function pg_temp.ex(n int default 1) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('v', 1, 'exercise', jsonb_build_object('name', 'E' || g, 'isCustom', false),
                                      'sets', jsonb_build_array(jsonb_build_object('reps', 8))))
  from generate_series(1, n) g
$$;

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.routines (user_id, name, day_type, exercises)
values ('a0000000-0000-0000-0000-00000000000a', 'Push Day A', '{"name":"Push","isCustom":false}', pg_temp.ex(3));

-- isolation
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.routines) = 0, 'bob cannot see alice''s routines';
end $$;
select pg_temp.expect_rows($q$update public.routines set name = 'hijacked'$q$, 0, 'bob cannot rename alice''s routine');
select pg_temp.expect_rows($q$delete from public.routines$q$, 0, 'bob cannot delete alice''s routine');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'Spoof', pg_temp.ex(1))$q$, 'bob cannot create a routine owned by alice');

select pg_temp.as_anon();
select pg_temp.expect_fail($q$select * from public.routines$q$, 'anon cannot read routines');

-- names: case/space-insensitive uniqueness, length bounds
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', '  push day a ', pg_temp.ex(1))$q$, 'duplicate name ignoring case and padding');
insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'Pull Day', pg_temp.ex(1));
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.routines (user_id, name, exercises) values ('b0000000-0000-0000-0000-00000000000b', 'Push Day A', pg_temp.ex(1)); -- same name, different user: fine
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', '', pg_temp.ex(1))$q$, 'empty name');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', '    ', pg_temp.ex(1))$q$, 'whitespace-only name');
insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', repeat('n', 60), pg_temp.ex(1));
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', repeat('n', 61), pg_temp.ex(1))$q$, '61-char name');

-- payload limits
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'zero', '[]')$q$, 'a routine needs at least one exercise');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'too many', pg_temp.ex(41))$q$, '41 exercises');
insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'forty', pg_temp.ex(40));
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'obj', '{"a":1}')$q$, 'exercises must be an array');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises)
  values ('a0000000-0000-0000-0000-00000000000a', 'huge', (select jsonb_agg(jsonb_build_object('pad', repeat('x', 3000))) from generate_series(1, 25)))$q$, 'payload over 60 KB');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises, notes) values ('a0000000-0000-0000-0000-00000000000a', 'noted', pg_temp.ex(1), repeat('n', 501))$q$, 'notes over 500');
select pg_temp.expect_fail($q$insert into public.routines (user_id, name, exercises, day_type) values ('a0000000-0000-0000-0000-00000000000a', 'dt', pg_temp.ex(1), jsonb_build_object('name', repeat('d', 400)))$q$, 'oversized day_type');

-- immutability: user_id/created_at/id can't change; allowed columns can
select pg_temp.expect_fail($q$update public.routines set user_id = 'b0000000-0000-0000-0000-00000000000b' where name = 'Pull Day'$q$, 'user_id reassignment is blocked');
select pg_temp.expect_fail($q$update public.routines set created_at = now() where name = 'Pull Day'$q$, 'created_at is immutable');
select pg_temp.expect_fail($q$update public.routines set id = gen_random_uuid() where name = 'Pull Day'$q$, 'id is immutable');
select pg_temp.expect_fail($q$update public.routines set updated_at = '2000-01-01' where name = 'Pull Day'$q$, 'updated_at is not client-writable');
select pg_temp.as_admin();
update public.routines set updated_at = '2000-01-01' where name = 'Pull Day';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($q$update public.routines set name = 'Pull Day 2', last_used_at = now() where name = 'Pull Day'$q$, 1, 'name and last_used_at are editable');
do $$ begin
  assert (select updated_at from public.routines where name = 'Pull Day 2') > now() - interval '1 minute', 'updated_at is maintained by a trigger';
end $$;
select pg_temp.expect_fail($q$update public.routines set exercises = '[]' where name = 'Pull Day 2'$q$, 'updates are validated too');

-- cap: 50 per user
select pg_temp.as_admin();
delete from public.routines where user_id = 'a0000000-0000-0000-0000-00000000000a';
insert into public.routines (user_id, name, exercises)
select 'a0000000-0000-0000-0000-00000000000a', 'r' || g, pg_temp.ex(1) from generate_series(1, 50) g;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail_msg($q$insert into public.routines (user_id, name, exercises) values ('a0000000-0000-0000-0000-00000000000a', 'fifty-one', pg_temp.ex(1))$q$, 'too_many_routines', '51st routine');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.routines (user_id, name, exercises) values ('b0000000-0000-0000-0000-00000000000b', 'bobs second', pg_temp.ex(1)); -- cap is per user

-- cascade with account deletion
select pg_temp.as_admin();
delete from auth.users where id = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.routines where user_id = 'a0000000-0000-0000-0000-00000000000a') = 0, 'routines cascade when the account is deleted';
  assert (select count(*) from public.routines where user_id = 'b0000000-0000-0000-0000-00000000000b') = 2, 'other users keep theirs';
end $$;

rollback;
