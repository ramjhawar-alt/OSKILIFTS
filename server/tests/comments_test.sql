-- Comment tests (access, moderation, blocks, limits, cleanup). Safe to run in the Supabase SQL editor:
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

-- ---------------------------------------------------------------------------
-- Fixtures: alice (a) owns workouts; bob (b) and dave (d) are accepted
-- followers; carol (c) is a stranger. w1 is shared with followers, w2 private.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 't_alice@berkeley.edu'),
  ('b0000000-0000-0000-0000-00000000000b', 't_bob@berkeley.edu'),
  ('c0000000-0000-0000-0000-00000000000c', 't_carol@berkeley.edu'),
  ('d0000000-0000-0000-0000-00000000000d', 't_dave@berkeley.edu'),
  ('e0000000-0000-0000-0000-00000000000e', 't_nameless@berkeley.edu');
update public.profiles set username = 'alice_lifts', display_name = 'Alice', terms_version = 'test' where id = 'a0000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob_lifts',   display_name = 'Bob',   terms_version = 'test' where id = 'b0000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol_lifts', display_name = 'Carol', terms_version = 'test' where id = 'c0000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave_lifts',  display_name = 'Dave',  terms_version = 'test' where id = 'd0000000-0000-0000-0000-00000000000d';

insert into public.follows (follower_id, followee_id, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('d0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'accepted'),
  ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'accepted');
insert into public.workouts (id, user_id, date, day_type, exercises, visibility) values
  ('e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Push","isCustom":false}', '[]', 'followers'),
  ('e2000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a', now(), '{"name":"Legs","isCustom":false}', '[]', 'private');

-- ---------------------------------------------------------------------------
-- the table itself is closed to everyone
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail($q$select * from public.workout_comments$q$, 'authenticated cannot select the table');
select pg_temp.expect_fail($q$insert into public.workout_comments (workout_id, user_id, body) values ('e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b', 'hi')$q$, 'authenticated cannot insert directly');
select pg_temp.expect_fail($q$update public.workout_comments set body = 'x'$q$, 'authenticated cannot update');
select pg_temp.expect_fail($q$delete from public.workout_comments$q$, 'authenticated cannot delete directly');

-- ---------------------------------------------------------------------------
-- who can comment
-- ---------------------------------------------------------------------------
do $$ declare r record; begin
  select * into r from public.add_comment('e1000000-0000-0000-0000-0000000000e1', '  Nice bench!  ');
  assert r.body = 'Nice bench!', 'body is trimmed';
  assert r.username = 'bob_lifts' and r.can_delete, 'returns the author and can_delete';
end $$;
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e2000000-0000-0000-0000-0000000000e2', 'hi')$q$, 'comment_target_not_found', 'follower cannot comment on a private workout');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('00000000-0000-0000-0000-000000000000', 'hi')$q$, 'comment_target_not_found', 'unknown workout');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'hi')$q$, 'comment_target_not_found', 'stranger cannot comment');

select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'hi')$q$, 'username_required', 'profile without a username cannot comment');

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  perform * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'Thanks!');
  perform * from public.add_comment('e2000000-0000-0000-0000-0000000000e2', 'note to self');
end $$;

-- ---------------------------------------------------------------------------
-- body validation and the word filter
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', '')$q$, 'comment_empty', 'empty');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', E'  \n\t ')$q$, 'comment_empty', 'whitespace only');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', null)$q$, 'comment_empty', 'null');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', E'\u200b\u200b \ufeff')$q$, 'comment_empty', 'only invisible characters');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', repeat('a', 501))$q$, 'comment_too_long', '501 chars');
do $$ begin
  perform * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', repeat('a', 500));
end $$;
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'you are a bitch')$q$, 'comment_not_allowed', 'abuse word');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'FUCKING lazy')$q$, 'comment_not_allowed', 'abuse word, case and suffix');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'what a 5h1t take')$q$, 'comment_not_allowed', 'leetspeak');
do $$ begin
  -- Words that merely contain blocked letters across a word boundary are fine.
  perform * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'this hit different, classic 5x5 at 225 :)');
end $$;

-- ---------------------------------------------------------------------------
-- From here on use fixed rows so every assertion is easy to verify.
--   k1 alice on w1 'Thanks!'   k2 bob on w1 'Nice bench!'   k3 dave on w1 'Same here'
--   k4 alice on w2 (private workout)
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
delete from public.workout_comments;
insert into public.workout_comments (id, workout_id, user_id, body, created_at) values
  ('51000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'Thanks!',       now() - interval '3 minutes'),
  ('52000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b', 'Nice bench!',    now() - interval '2 minutes'),
  ('53000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-00000000000d', 'Same here',      now() - interval '1 minute'),
  ('54000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-0000000000e2', 'a0000000-0000-0000-0000-00000000000a', 'note to self',   now());

-- ---------------------------------------------------------------------------
-- reading
-- ---------------------------------------------------------------------------
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select array_agg(body order by created_at, id) from public.get_comments('e1000000-0000-0000-0000-0000000000e1'))
    = array['Thanks!', 'Nice bench!', 'Same here'], 'follower sees the three comments, oldest first';
  assert (select array_agg(body) from public.get_comments('e1000000-0000-0000-0000-0000000000e1') where can_delete) = array['Nice bench!'],
    'follower can delete only their own';
  assert (select count(*) from public.get_comments('e2000000-0000-0000-0000-0000000000e2')) = 0, 'private workout comments hidden from a follower';
  assert (select comment_count from public.get_comment_counts(array['e1000000-0000-0000-0000-0000000000e1']::uuid[])) = 3, 'count matches';
  assert (select count(*) from public.get_comment_counts(array['e2000000-0000-0000-0000-0000000000e2']::uuid[])) = 0, 'no count for a workout I cannot see';
  assert (select count(*) from public.get_comment_counts(null)) = 0, 'null id list is harmless';
end $$;

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = 0, 'stranger reads nothing';
  assert (select count(*) from public.get_comment_counts(array['e1000000-0000-0000-0000-0000000000e1']::uuid[])) = 0, 'stranger gets no counts';
end $$;

select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = 3, 'owner sees comments on their workout';
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1') where can_delete) = 3, 'owner can delete every comment on their workout';
  assert (select count(*) from public.get_comments('e2000000-0000-0000-0000-0000000000e2')) = 1, 'owner sees comments on their private workout';
end $$;

-- ---------------------------------------------------------------------------
-- reports (before any deletes or blocks)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.submit_report('comment', '51000000-0000-0000-0000-000000000001', 'spam', 'test');
select public.submit_report('comment', '51000000-0000-0000-0000-000000000001', 'spam', 'test');  -- duplicate is a no-op
select pg_temp.expect_fail_msg($q$select public.submit_report('comment', '00000000-0000-0000-0000-000000000000', 'spam')$q$, 'report_target_not_found', 'unknown comment');
select pg_temp.expect_fail_msg($q$select public.submit_report('comment', '54000000-0000-0000-0000-000000000004', 'spam')$q$, 'report_target_not_found', 'cannot report a comment on a workout I cannot see');
select pg_temp.expect_fail_msg($q$select public.submit_report('comment', '53000000-0000-0000-0000-000000000003', 'spam')$q$, 'cannot_report_self', 'cannot report my own comment');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail_msg($q$select public.submit_report('comment', '51000000-0000-0000-0000-000000000001', 'spam')$q$, 'report_target_not_found', 'a stranger cannot report a comment they cannot see');
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.reports where target_type = 'comment') = 1, 'exactly one comment report stored';
  assert (select snapshot->>'body' from public.reports where target_type = 'comment') = 'Thanks!', 'report keeps the comment text as evidence';
  assert (select reported_user_id from public.reports where target_type = 'comment') = 'a0000000-0000-0000-0000-00000000000a', 'reports the author';
end $$;

-- ---------------------------------------------------------------------------
-- deleting
-- ---------------------------------------------------------------------------
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_fail_msg($q$select public.delete_comment('52000000-0000-0000-0000-000000000002')$q$, 'comment_not_found', 'another follower cannot delete bob''s comment');
select pg_temp.expect_fail_msg($q$select public.delete_comment('00000000-0000-0000-0000-000000000000')$q$, 'comment_not_found', 'deleting a missing comment');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_fail_msg($q$select public.delete_comment('52000000-0000-0000-0000-000000000002')$q$, 'comment_not_found', 'a stranger cannot delete');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.delete_comment('52000000-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = 2, 'author deleted their own comment';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.delete_comment('53000000-0000-0000-0000-000000000003');
do $$ begin
  assert (select array_agg(body) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = array['Thanks!'], 'workout owner deleted a follower''s comment';
end $$;

-- ---------------------------------------------------------------------------
-- blocks hide people in both directions (rows restored as admin)
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
insert into public.workout_comments (id, workout_id, user_id, body, created_at) values
  ('52000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b', 'Nice bench!', now() - interval '2 minutes'),
  ('53000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-00000000000d', 'Same here',   now() - interval '1 minute');

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
insert into public.blocks (blocker_id, blocked_id) values ('b0000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select array_agg(body order by created_at) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = array['Thanks!', 'Nice bench!'],
    'someone I blocked is hidden from my comment list';
  assert (select comment_count from public.get_comment_counts(array['e1000000-0000-0000-0000-0000000000e1']::uuid[])) = 2, 'and from my counts';
end $$;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select array_agg(body order by created_at) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = array['Thanks!', 'Same here'],
    'someone who blocked me is hidden from my comment list (I still see my own)';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select array_agg(body order by created_at) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = array['Thanks!', 'Same here'],
    'the workout owner no longer sees comments from someone they blocked';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1')) = 0, 'a blocked user cannot read the blocker''s workout comments';
end $$;
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'let me in')$q$, 'comment_target_not_found', 'a blocked user cannot comment');

-- ---------------------------------------------------------------------------
-- limits: 50 on one workout; 30 per hour
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
delete from public.blocks;
insert into public.follows (follower_id, followee_id, status) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'accepted')
  on conflict do nothing;
delete from public.workout_comments;
-- dave: 50 older-than-an-hour comments on w1
insert into public.workout_comments (workout_id, user_id, body, created_at)
select 'e1000000-0000-0000-0000-0000000000e1', 'd0000000-0000-0000-0000-00000000000d', 'old ' || g, now() - interval '2 hours'
from generate_series(1, 50) g;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'one more')$q$, 'too_many_comments_on_workout', '51st comment on one workout');
-- bob: 35 recent comments (also the pagination fixture; ties share a timestamp)
select pg_temp.as_admin();
insert into public.workout_comments (workout_id, user_id, body, created_at)
select 'e1000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-00000000000b', 'bob ' || g,
       now() - interval '30 minutes' + ((g - 1) / 3) * interval '1 second'
from generate_series(1, 35) g;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'too fast')$q$, 'comment_rate_limited', 'hourly limit');

-- keyset pagination over everything on w1 (85 comments: 50 dave + 35 bob)
do $$
declare
  seen int := 0; pages int := 0; n int;
  cur_at timestamptz := null; cur_id uuid := null;
begin
  loop
    select count(*), (array_agg(created_at order by created_at desc, id desc))[1], (array_agg(id order by created_at desc, id desc))[1]
      into n, cur_at, cur_id
    from public.get_comments('e1000000-0000-0000-0000-0000000000e1', 30, cur_at, cur_id);
    exit when n = 0;
    seen := seen + n; pages := pages + 1;
    assert pages < 10, 'pagination must terminate';
  end loop;
  assert seen = 85, format('every comment is visited exactly once, saw %s', seen);
  assert pages = 3, format('30 + 30 + 25, got %s pages', pages);
  assert (select count(*) from public.get_comment_counts(array['e1000000-0000-0000-0000-0000000000e1']::uuid[])) = 1, 'counts work at scale';
  assert (select comment_count from public.get_comment_counts(array['e1000000-0000-0000-0000-0000000000e1']::uuid[])) = 85, 'count is 85';
end $$;

-- the page size is capped at 100 no matter what the client asks for
select pg_temp.as_admin();
insert into public.workout_comments (id, workout_id, user_id, body, created_at)
select gen_random_uuid(), 'e1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a', 'owner ' || g, now() - interval '3 hours'
from generate_series(1, 20) g;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1', 1000)) = 100, 'limit capped at 100 (105 exist)';
  assert (select count(*) from public.get_comments('e1000000-0000-0000-0000-0000000000e1', 0)) = 1, 'limit floors at 1';
end $$;
select pg_temp.as_admin();
delete from public.workout_comments where body like 'owner %';

-- ---------------------------------------------------------------------------
-- cleanup: deleting a workout or an account removes the comments
-- ---------------------------------------------------------------------------
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.workout_comments where user_id = 'b0000000-0000-0000-0000-00000000000b') = 35, 'bob has 35 before deleting his account';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.delete_my_account();
select pg_temp.as_admin();
do $$ begin
  assert (select count(*) from public.workout_comments where user_id = 'b0000000-0000-0000-0000-00000000000b') = 0, 'deleting an account removes its comments';
  assert (select count(*) from public.workout_comments) = 50, 'other people''s comments stay';
end $$;
delete from public.workouts where id = 'e1000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert (select count(*) from public.workout_comments) = 0, 'deleting a workout removes its comments';
end $$;

-- ---------------------------------------------------------------------------
-- anon can touch none of it
-- ---------------------------------------------------------------------------
select pg_temp.as_anon();
select pg_temp.expect_fail_msg($q$select * from public.workout_comments$q$, 'permission denied', 'anon cannot read the table');
select pg_temp.expect_fail_msg($q$select * from public.get_comments('e1000000-0000-0000-0000-0000000000e1')$q$, 'permission denied', 'anon cannot call get_comments');
select pg_temp.expect_fail_msg($q$select * from public.get_comment_counts(array['e1000000-0000-0000-0000-0000000000e1']::uuid[])$q$, 'permission denied', 'anon cannot call get_comment_counts');
select pg_temp.expect_fail_msg($q$select * from public.add_comment('e1000000-0000-0000-0000-0000000000e1', 'hi')$q$, 'permission denied', 'anon cannot call add_comment');
select pg_temp.expect_fail_msg($q$select public.delete_comment('51000000-0000-0000-0000-000000000001')$q$, 'permission denied', 'anon cannot call delete_comment');
select pg_temp.expect_fail_msg($q$select private.is_comment_allowed('hi')$q$, 'permission denied', 'anon cannot call the private filter');

select pg_temp.as_admin();
rollback;
