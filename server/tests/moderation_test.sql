-- Moderation queue tests (admin-only, actions, sibling reports, content removal). Safe to run in the Supabase SQL editor:
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
-- Fixtures. alice (a) posts; bob (b) and carol (c) follow her; dave (d) is the admin;
-- erin (e) is an ordinary user.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'), ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'), ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 'ram_jhawar@berkeley.edu'), ('e0000000-0000-0000-0000-00000000000e', 't_erin@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_admin',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';
update public.profiles set username = 'erin_lifts',  display_name = 'Erin',  terms_version = 'test' where id = 'e0000000-0000-0000-0000-00000000000e';
insert into public.follows (follower_id, followee_id, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'), ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'accepted');
insert into public.workouts (id, user_id, date, day_type, exercises, notes, visibility) values
  ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]', 'bad note', 'followers'),
  ('e2000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Legs","isCustom":false}', '[]', 'fine', 'followers');

-- the same statement the migration uses makes the project owner an admin
insert into public.admins (user_id)
select u.id from auth.users u where lower(u.email) = 'ram_jhawar@berkeley.edu'
on conflict do nothing;
do $$ begin
  assert (select count(*) from public.admins) = 1 and exists (select 1 from public.admins where user_id = 'd0000000-0000-0000-0000-00000000000d'), 'the owner (by email) is the only admin';
end $$;

-- comments + reports from bob and carol
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'rude comment');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'another comment');
do $$ declare cid uuid; begin
  select id into cid from public.get_comments('e1000000-0000-0000-0000-0000000000e1') where body = 'rude comment';
  perform public.submit_report('comment', cid, 'harassment', 'mean');
  perform public.submit_report('workout', 'e1000000-0000-0000-0000-0000000000e1', 'other', 'bad notes');
  perform public.submit_report('workout', 'e2000000-0000-0000-0000-0000000000e2', 'spam', null);
  perform public.submit_report('profile', 'a0000000-0000-0000-0000-00000000000a', 'other', null);
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.submit_report('workout', 'e1000000-0000-0000-0000-0000000000e1', 'hate', 'second report on the same workout');
end $$;

-- ---------------------------------------------------------------------------
-- the admins table is closed, and everyone else is refused
-- ---------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select pg_temp.expect_fail($q$select * from public.admins$q$, 'authenticated cannot read admins');
select pg_temp.expect_fail($q$insert into public.admins (user_id) values ('e0000000-0000-0000-0000-00000000000e')$q$, 'cannot make myself an admin');
select pg_temp.expect_fail($q$delete from public.admins$q$, 'cannot delete admins');
select pg_temp.expect_fail_msg($q$select * from public.admin_list_reports()$q$, 'not_admin', 'non-admin cannot list');
select pg_temp.expect_fail_msg($q$select public.admin_resolve_report(gen_random_uuid(), 'dismiss')$q$, 'not_admin', 'non-admin cannot resolve');
do $$ begin
  assert not public.am_i_admin(), 'not an admin';
  assert public.admin_open_report_count() = 0, 'non-admins always see a count of 0 (no leak of how many reports exist)';
end $$;
-- the person being reported is not an admin either
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_fail_msg($q$select * from public.admin_list_reports()$q$, 'not_admin', 'the reported user cannot read reports about themselves');

-- ---------------------------------------------------------------------------
-- the admin's view
-- ---------------------------------------------------------------------------
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert public.am_i_admin(), 'dave is an admin';
  assert public.admin_open_report_count() = 5, 'five open reports';
  assert (select count(*) from public.admin_list_reports()) = 5, 'all five listed';
  assert (select count(*) from public.admin_list_reports('open', 2)) = 2, 'limit works';
  assert (select count(*) from public.admin_list_reports('resolved')) = 0, 'nothing resolved yet';
  assert (select snapshot->>'body' from public.admin_list_reports() where target_type = 'comment') = 'rude comment', 'the comment text is preserved as evidence';
  assert (select reporter_username from public.admin_list_reports() where target_type = 'comment') = 'carol_lifts', 'reporter is shown to the admin';
  assert (select reported_username from public.admin_list_reports() where target_type = 'comment') = 'bob_lifts', 'and who is reported';
  assert (select max(reports_against_user) from public.admin_list_reports() where reported_username = 'alice_lifts') = 4, 'alice has 4 reports against her in total (two on one workout, one on another, one on her profile)';
  assert (select bool_and(target_exists) from public.admin_list_reports()), 'targets exist';
end $$;

-- ---------------------------------------------------------------------------
-- actions
-- ---------------------------------------------------------------------------
select pg_temp.expect_fail_msg($q$select public.admin_resolve_report(gen_random_uuid(), 'dismiss')$q$, 'report_not_found', 'unknown report');
select pg_temp.expect_fail_msg($q$select public.admin_resolve_report((select id from public.admin_list_reports() limit 1), 'ban')$q$, 'invalid_action', 'unknown action');

-- removing a workout hides it (only me), keeps the data, and closes BOTH reports on it
do $$ declare r1 uuid; begin
  select id into r1 from public.admin_list_reports() where target_type = 'workout' and target_id = 'e1000000-0000-0000-0000-0000000000e1' limit 1;
  perform public.admin_resolve_report(r1, 'remove');
end $$;
select pg_temp.as_admin();
do $$ begin
  assert (select visibility from public.workouts where id = 'e1000000-0000-0000-0000-0000000000e1') = 'private', 'the workout is hidden, not deleted';
  assert (select notes from public.workouts where id = 'e1000000-0000-0000-0000-0000000000e1') = 'bad note', 'and the owner keeps their data';
  assert (select count(*) from public.reports where target_id = 'e1000000-0000-0000-0000-0000000000e1' and status = 'actioned') = 2, 'both reports on that workout are actioned';
  assert (select count(*) from public.reports where target_id = 'e1000000-0000-0000-0000-0000000000e1' and reviewed_by = 'd0000000-0000-0000-0000-00000000000d' and reviewed_at is not null) = 2, 'with who and when';
  assert (select count(*) from public.reports where status = 'open') = 3, 'other reports are untouched';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert not private.can_view_workout('e1000000-0000-0000-0000-0000000000e1'), 'followers can no longer see the removed workout';
end $$;

-- removing a comment deletes it
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ declare rc uuid; begin
  select id into rc from public.admin_list_reports() where target_type = 'comment';
  perform public.admin_resolve_report(rc, 'remove');
end $$;
select pg_temp.as_admin();
do $$ begin
  assert not exists (select 1 from public.workout_comments where body = 'rude comment'), 'the comment is gone';
  assert (select count(*) from public.workout_comments where body = 'another comment') = 1, 'other comments stay';
  assert (select status from public.reports where target_type = 'comment') = 'actioned', 'its report is actioned';
end $$;

-- the list now shows resolved ones separately, and the removed comment's report says the target is gone
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.admin_list_reports('resolved')) = 3, 'three resolved';
  assert (select count(*) from public.admin_list_reports('all')) = 5, 'five in total';
  assert not (select target_exists from public.admin_list_reports('resolved') where target_type = 'comment'), 'a deleted comment is flagged as gone';
  assert (select array_agg(status) from public.admin_list_reports('all')) = array['open', 'open', 'actioned', 'actioned', 'actioned'], 'open reports come first';
end $$;

-- profile reports cannot be removed here; dismiss and reviewed work
select pg_temp.expect_fail_msg($q$select public.admin_resolve_report((select id from public.admin_list_reports() where target_type = 'profile'), 'remove')$q$, 'cannot_remove_profile', 'profiles are handled in the dashboard');
do $$ declare rp uuid; rw uuid; begin
  select id into rp from public.admin_list_reports() where target_type = 'profile';
  perform public.admin_resolve_report(rp, 'reviewed');
  select id into rw from public.admin_list_reports() where target_type = 'workout';
  perform public.admin_resolve_report(rw, 'dismiss');
  assert public.admin_open_report_count() = 0, 'queue is empty';
  assert (select status from public.admin_list_reports('resolved') where target_type = 'profile') = 'reviewed', 'reviewed';
  assert (select status from public.admin_list_reports('resolved') where target_type = 'workout' and target_id = 'e2000000-0000-0000-0000-0000000000e2') = 'dismissed', 'dismissed';
end $$;

-- resolving something already resolved does not rewrite history
select pg_temp.as_admin();
update public.reports set reviewed_at = now() - interval '1 day' where target_type = 'profile';
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.admin_resolve_report((select id from public.admin_list_reports('resolved') where target_type = 'profile'), 'dismiss');
select pg_temp.as_admin();
do $$ begin
  assert (select status from public.reports where target_type = 'profile') = 'reviewed', 'an already-resolved report keeps its outcome';
end $$;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.admins$q$, 'permission denied', 'anon cannot read admins');
select pg_temp.expect_fail_msg($q$select public.am_i_admin()$q$, 'permission denied', 'anon cannot ask');
select pg_temp.expect_fail_msg($q$select public.admin_open_report_count()$q$, 'permission denied', 'anon cannot count');
select pg_temp.expect_fail_msg($q$select * from public.admin_list_reports()$q$, 'permission denied', 'anon cannot list');
select pg_temp.expect_fail_msg($q$select public.admin_resolve_report(gen_random_uuid(), 'dismiss')$q$, 'permission denied', 'anon cannot resolve');

select pg_temp.as_admin();
rollback;
