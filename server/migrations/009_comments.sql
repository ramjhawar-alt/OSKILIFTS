-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 2: comments on workouts.
-- Requires 003, 004 and 005.
--
-- Privacy model: the table has NO direct access for anyone (RLS on, no
-- policies, no grants). Comments are read and written only through the
-- SECURITY DEFINER functions below, and each one first asks
-- private.can_view_workout(), so you can comment on / read comments of exactly
-- the workouts you can already see (your own, or an accepted follower's
-- followers-visible ones, with no block in either direction).
--
-- NOTE: this migration redefines public.submit_report (adds target 'comment').
-- Re-running 005 afterwards restores the old version; run this file again if so.

-- ---------------------------------------------------------------------------
-- table
-- ---------------------------------------------------------------------------
create table if not exists public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500 and body = btrim(body)),
  created_at timestamptz not null default now()
);

create index if not exists workout_comments_workout_idx
  on public.workout_comments (workout_id, created_at, id);
create index if not exists workout_comments_user_idx
  on public.workout_comments (user_id, created_at desc);

alter table public.workout_comments enable row level security;
revoke all on public.workout_comments from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- comment text filter. The username filter strips spaces and matches
-- substrings, which would reject "this hit different" (…s-hit…). For free text
-- match whole words instead: a word is rejected when it STARTS with a blocked
-- 'abuse' term (so "fucking" and "bitches" are caught, "hit" is not).
-- ---------------------------------------------------------------------------
create or replace function private.is_comment_allowed(p_text text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from regexp_split_to_table(
           lower(translate(coalesce(p_text, ''), '013457@$', 'oieastas')),
           '[^a-z]+') as tok
    join public.blocked_terms t
      on t.kind = 'abuse'
     and tok <> ''
     and left(tok, char_length(t.term)) = t.term
  )
$$;

-- ---------------------------------------------------------------------------
-- get_comments: oldest first, keyset-paginated (pass the last row's
-- created_at as the RAW string plus its id as the cursor).
-- ---------------------------------------------------------------------------
create or replace function public.get_comments(
  p_workout uuid,
  p_limit int default 30,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  body text,
  created_at timestamptz,
  can_delete boolean
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.id, c.user_id, p.username, p.display_name, c.body, c.created_at,
    (c.user_id = auth.uid() or w.user_id = auth.uid()) as can_delete
  from public.workout_comments c
  join public.workouts w on w.id = c.workout_id
  join public.profiles p on p.id = c.user_id
  where c.workout_id = p_workout
    and auth.uid() is not null
    and private.can_view_workout(p_workout)
    and p.username is not null
    and (c.user_id = auth.uid() or not private.is_blocked_between(auth.uid(), c.user_id))
    and (p_after_created_at is null
         or (c.created_at, c.id) > (p_after_created_at, p_after_id))
  order by c.created_at, c.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;

-- ---------------------------------------------------------------------------
-- get_comment_counts: counts for a page of workouts (at most 50 ids), only for
-- workouts the caller can see and only comments the caller can see.
-- ---------------------------------------------------------------------------
create or replace function public.get_comment_counts(p_workout_ids uuid[])
returns table (workout_id uuid, comment_count bigint)
language sql stable security definer
set search_path = ''
as $$
  with ids as (
    select distinct i as id
    from unnest(coalesce(p_workout_ids[1:50], '{}'::uuid[])) as i
    where auth.uid() is not null and private.can_view_workout(i)
  )
  select c.workout_id, count(*)
  from ids
  join public.workout_comments c on c.workout_id = ids.id
  where c.user_id = auth.uid() or not private.is_blocked_between(auth.uid(), c.user_id)
  group by c.workout_id
$$;

-- ---------------------------------------------------------------------------
-- add_comment: returns the new comment in the same shape as get_comments.
-- ---------------------------------------------------------------------------
create or replace function public.add_comment(p_workout uuid, p_body text)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  body text,
  created_at timestamptz,
  can_delete boolean
)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  -- btrim() only strips spaces; trim every kind of whitespace.
  v_body text := regexp_replace(coalesce(p_body, ''), '^\s+|\s+$', '', 'g');
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not private.can_view_workout(p_workout) then
    raise exception 'comment_target_not_found';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_me and p.username is not null) then
    raise exception 'username_required';
  end if;
  -- Empty, or nothing but whitespace / zero-width characters.
  if v_body !~ '[^\s\u200b-\u200f\u2060\ufeff]' then
    raise exception 'comment_empty';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'comment_too_long';
  end if;
  if not private.is_comment_allowed(v_body) then
    raise exception 'comment_not_allowed';
  end if;

  if (select count(*) from public.workout_comments c
      where c.user_id = v_me and c.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'comment_rate_limited';
  end if;
  if (select count(*) from public.workout_comments c
      where c.user_id = v_me and c.workout_id = p_workout) >= 50 then
    raise exception 'too_many_comments_on_workout';
  end if;

  insert into public.workout_comments (workout_id, user_id, body)
  values (p_workout, v_me, v_body)
  returning workout_comments.id into v_id;

  return query
    select c.id, c.user_id, p.username, p.display_name, c.body, c.created_at,
           true as can_delete
    from public.workout_comments c
    join public.profiles p on p.id = c.user_id
    where c.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_comment: the author, or the owner of the workout (moderating their own
-- post). Anyone else gets the same error as for a comment that doesn't exist.
-- ---------------------------------------------------------------------------
create or replace function public.delete_comment(p_comment uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_deleted int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.workout_comments c
  using public.workouts w
  where c.id = p_comment
    and w.id = c.workout_id
    and (c.user_id = v_me or w.user_id = v_me);
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'comment_not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- reports can now target a comment
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('workout', 'profile', 'comment'));

create or replace function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_reported uuid;
  v_snapshot jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  if p_target_type = 'workout' then
    if not private.can_view_workout(p_target_id) then
      raise exception 'report_target_not_found';
    end if;
    select w.user_id,
           jsonb_build_object(
             'username', p.username, 'display_name', p.display_name,
             'date', w.date, 'day_type', w.day_type, 'exercises', w.exercises,
             'notes', w.notes, 'visibility', w.visibility)
      into v_reported, v_snapshot
      from public.workouts w
      join public.profiles p on p.id = w.user_id
      where w.id = p_target_id;
  elsif p_target_type = 'profile' then
    select p.id,
           jsonb_build_object('username', p.username, 'display_name', p.display_name)
      into v_reported, v_snapshot
      from public.profiles p
      where p.id = p_target_id and not private.has_blocked_me(p.id);
  elsif p_target_type = 'comment' then
    -- Only a comment the reporter can actually see.
    select c.user_id,
           jsonb_build_object(
             'username', p.username, 'display_name', p.display_name,
             'body', c.body, 'workout_id', c.workout_id, 'created_at', c.created_at)
      into v_reported, v_snapshot
      from public.workout_comments c
      join public.profiles p on p.id = c.user_id
      where c.id = p_target_id
        and private.can_view_workout(c.workout_id)
        and (c.user_id = v_me or not private.is_blocked_between(v_me, c.user_id));
  else
    raise exception 'invalid_target_type';
  end if;

  if v_reported is null then
    raise exception 'report_target_not_found';
  end if;
  if v_reported = v_me then
    raise exception 'cannot_report_self';
  end if;

  if (select count(*) from public.reports r
      where r.reporter_id = v_me and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'report_rate_limited';
  end if;

  -- Re-reporting the same thing is a no-op, not an error.
  insert into public.reports
    (reporter_id, target_type, target_id, reported_user_id, reason, details, snapshot)
  values
    (v_me, p_target_type, p_target_id, v_reported, p_reason, p_details, v_snapshot)
  on conflict (reporter_id, target_type, target_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- function privileges (Supabase grants EXECUTE on new functions to anon)
-- ---------------------------------------------------------------------------
revoke all on function private.is_comment_allowed(text) from public, anon;

revoke all on function public.get_comments(uuid, int, timestamptz, uuid) from public, anon;
revoke all on function public.get_comment_counts(uuid[]) from public, anon;
revoke all on function public.add_comment(uuid, text) from public, anon;
revoke all on function public.delete_comment(uuid) from public, anon;
revoke all on function public.submit_report(text, uuid, text, text) from public, anon;
grant execute on function public.get_comments(uuid, int, timestamptz, uuid) to authenticated;
grant execute on function public.get_comment_counts(uuid[]) to authenticated;
grant execute on function public.add_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
