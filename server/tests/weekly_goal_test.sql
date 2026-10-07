-- Weekly goal tests (private, 1-7 days, clearing). Safe to run in the Supabase SQL editor:
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

insert into auth.users (id, email) values ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu');
update public.profiles set username = 'alice_lifts', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts', terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
insert into public.follows (follower_id, followee_id, status) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'accepted'), ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted');

-- the table is closed
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail($q$select * from public.user_goals$q$, 'authenticated cannot select the table');
select pg_temp.expect_fail($q$insert into public.user_goals (user_id, weekly_days) values ('a0000000-0000-0000-0000-00000000000a', 3)$q$, 'cannot insert directly');
select pg_temp.expect_fail($q$update public.user_goals set weekly_days = 7$q$, 'cannot update directly');

-- setting, changing, reading
do $$ begin
  assert public.get_weekly_goal() is null, 'no goal at first';
  perform public.set_weekly_goal(4);
  assert public.get_weekly_goal() = 4, 'goal is 4';
  perform public.set_weekly_goal(7);
  assert public.get_weekly_goal() = 7, 'goal can change (7 is allowed)';
  perform public.set_weekly_goal(1);
  assert public.get_weekly_goal() = 1, '1 is allowed';
end $$;
select pg_temp.expect_fail_msg($q$select public.set_weekly_goal(8)$q$, 'invalid_goal', 'more than 7 days');
select pg_temp.expect_fail_msg($q$select public.set_weekly_goal(-2)$q$, 'invalid_goal', 'negative');
do $$ begin
  assert public.get_weekly_goal() = 1, 'a rejected value changes nothing';
end $$;

-- private: a friend cannot read it, and has their own
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert public.get_weekly_goal() is null, 'bob does not see alice''s goal';
  perform public.set_weekly_goal(3);
  assert public.get_weekly_goal() = 3, 'bob has his own';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert public.get_weekly_goal() = 1, 'and alice''s is untouched';
end $$;

-- clearing (0 or null), and clearing when there is none
select public.set_weekly_goal(0);
do $$ begin
  assert public.get_weekly_goal() is null, '0 clears the goal';
  perform public.set_weekly_goal(5);
  perform public.set_weekly_goal(null);
  assert public.get_weekly_goal() is null, 'null clears the goal';
end $$;
select public.set_weekly_goal(null);
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert public.get_weekly_goal() = 3, 'clearing my goal never touches anyone else''s';
end $$;

-- the CHECK holds even for the table owner
select pg_temp.as_admin();
select pg_temp.expect_fail($q$insert into public.user_goals (user_id, weekly_days) values ('a0000000-0000-0000-0000-00000000000a', 9)$q$, 'CHECK 1..7');

-- account deletion
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.user_goals where user_id = 'b0000000-0000-0000-0000-00000000000b') = 0, 'deleting an account removes its goal';
end $$;

-- anon
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.user_goals$q$, 'permission denied', 'anon cannot read the table');
select pg_temp.expect_fail_msg($q$select public.set_weekly_goal(3)$q$, 'permission denied', 'anon cannot set');
select pg_temp.expect_fail_msg($q$select public.get_weekly_goal()$q$, 'permission denied', 'anon cannot read');

select pg_temp.as_admin();
rollback;
