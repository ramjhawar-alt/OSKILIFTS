-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 2, step 2: follow requests, per-workout visibility, feed/profile/search RPCs.
-- Requires 002 and 003.
--
-- Privacy model: `workouts` stays OWNER-ONLY forever (no follower SELECT policy).
-- Other people's workouts are readable only through the SECURITY DEFINER
-- functions below, so no query path (current client, old client, future client)
-- can read a workout row that isn't yours.

-- ---------------------------------------------------------------------------
-- stub, replaced with a real lookup in 005 (blocks)
-- ---------------------------------------------------------------------------
create or replace function private.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select false $$;

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_status_idx on public.follows (followee_id, status);
create index if not exists follows_follower_status_idx on public.follows (follower_id, status);

alter table public.follows enable row level security;
revoke all on public.follows from anon;
revoke truncate, references, trigger on public.follows from authenticated;

drop policy if exists "follows_select_party" on public.follows;
create policy "follows_select_party" on public.follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

drop policy if exists "follows_insert_request" on public.follows;
create policy "follows_insert_request" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and status = 'pending');

-- Only the person being followed can accept.
drop policy if exists "follows_update_accept" on public.follows;
create policy "follows_update_accept" on public.follows
  for update to authenticated
  using (followee_id = (select auth.uid()))
  with check (followee_id = (select auth.uid()) and status = 'accepted');

-- Unfollow (follower), reject a request or remove a follower (followee).
drop policy if exists "follows_delete_party" on public.follows;
create policy "follows_delete_party" on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- A table-level UPDATE grant overrides column grants, so revoke it first. This
-- stops a followee from rewriting follower_id/followee_id on a row they can update.
revoke update on public.follows from authenticated;
grant update (status) on public.follows to authenticated;

create or replace function private.follows_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.is_blocked_between(new.follower_id, new.followee_id) then
    raise exception 'follow_blocked';
  end if;

  if (select count(*) from public.follows f
      where f.follower_id = new.follower_id and f.status = 'pending') >= 100 then
    raise exception 'too_many_pending_requests';
  end if;

  if (select count(*) from public.follows f
      where f.follower_id = new.follower_id
        and f.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'follow_rate_limited';
  end if;

  return new;
end;
$$;

drop trigger if exists follows_guard_trigger on public.follows;
create trigger follows_guard_trigger
  before insert on public.follows
  for each row execute function private.follows_guard();

-- ---------------------------------------------------------------------------
-- workouts.visibility
--   Added with default 'private' so every EXISTING workout is backfilled to
--   private atomically (they were logged before sharing existed), then the
--   default flips to 'followers' for new workouts.
-- ---------------------------------------------------------------------------
alter table public.workouts add column if not exists visibility text not null default 'private';
alter table public.workouts drop constraint if exists workouts_visibility_check;
alter table public.workouts add constraint workouts_visibility_check
  check (visibility in ('followers', 'private'));
alter table public.workouts alter column visibility set default 'followers';

create index if not exists workouts_feed_idx
  on public.workouts (user_id, created_at desc, id desc)
  where visibility = 'followers';

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
-- Can the caller see this workout? (own, or shared with followers and the caller
-- is an accepted follower and nobody has blocked anybody.)
create or replace function private.can_view_workout(p_workout uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout
      and (
        w.user_id = auth.uid()
        or (
          w.visibility = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.followee_id = w.user_id
              and f.status = 'accepted'
          )
          and not private.is_blocked_between(auth.uid(), w.user_id)
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- get_feed: workouts shared with me, newest posted first, keyset-paginated.
-- Pass the last row's created_at (as the RAW string from the response: a JS
-- Date round-trip truncates microseconds) and id as the cursor.
-- The per-followee LATERAL ... LIMIT bounds work to followees x page size.
-- ---------------------------------------------------------------------------
create or replace function public.get_feed(
  p_limit int default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  date timestamptz,
  day_type jsonb,
  exercises jsonb,
  notes text,
  created_at timestamptz,
  like_count bigint,
  liked_by_me boolean
)
language sql stable security definer
set search_path = ''
as $$
  select
    w.id, w.user_id, p.username, p.display_name, w.date, w.day_type,
    w.exercises, w.notes, w.created_at,
    0::bigint as like_count,       -- real counts arrive with 005
    false as liked_by_me
  from public.follows f
  cross join lateral (
    select w2.*
    from public.workouts w2
    where w2.user_id = f.followee_id
      and w2.visibility = 'followers'
      and (p_before_created_at is null
           or (w2.created_at, w2.id) < (p_before_created_at, p_before_id))
    order by w2.created_at desc, w2.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  ) w
  join public.profiles p on p.id = w.user_id
  where f.follower_id = auth.uid()
    and f.status = 'accepted'
    and not private.is_blocked_between(auth.uid(), f.followee_id)
  order by w.created_at desc, w.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- get_profile_summary: what a profile page needs. Counts are accepted follows
-- only. workout_count / workout_dates are returned only for yourself or for
-- people you follow, and for others cover only workouts shared with followers.
-- Returns no row if that user has blocked me.
-- ---------------------------------------------------------------------------
create or replace function public.get_profile_summary(p_user uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  follower_count bigint,
  following_count bigint,
  relationship text,
  workout_count bigint,
  workout_dates timestamptz[]
)
language sql stable security definer
set search_path = ''
as $$
  with rel as (
    select case
      when p_user = auth.uid() then 'self'
      when exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followee_id = p_user
                     and f.status = 'accepted') then 'following'
      when exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followee_id = p_user
                     and f.status = 'pending') then 'pending_out'
      when exists (select 1 from public.follows f
                   where f.follower_id = p_user and f.followee_id = auth.uid()
                     and f.status = 'pending') then 'pending_in'
      else 'none'
    end as r
  )
  select
    p.id, p.username, p.display_name,
    (select count(*) from public.follows f where f.followee_id = p.id and f.status = 'accepted'),
    (select count(*) from public.follows f where f.follower_id = p.id and f.status = 'accepted'),
    rel.r,
    case when rel.r in ('self', 'following') then
      (select count(*) from public.workouts w
       where w.user_id = p.id and (rel.r = 'self' or w.visibility = 'followers'))
    end,
    case when rel.r in ('self', 'following') then
      array(select w.date from public.workouts w
            where w.user_id = p.id and (rel.r = 'self' or w.visibility = 'followers')
            order by w.date desc limit 400)
    end
  from public.profiles p
  cross join rel
  where p.id = p_user
    and auth.uid() is not null
    and (p.id = auth.uid() or not private.is_blocked_between(auth.uid(), p.id))
$$;

-- ---------------------------------------------------------------------------
-- search_profiles: username prefix search (min 2 chars), excludes yourself and
-- anyone blocked in either direction, returns my relationship to each result.
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(p_prefix text)
returns table (
  id uuid,
  username text,
  display_name text,
  relationship text
)
language sql stable security definer
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name,
    case
      when exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followee_id = p.id
                     and f.status = 'accepted') then 'following'
      when exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followee_id = p.id
                     and f.status = 'pending') then 'pending_out'
      when exists (select 1 from public.follows f
                   where f.follower_id = p.id and f.followee_id = auth.uid()
                     and f.status = 'pending') then 'pending_in'
      else 'none'
    end
  from public.profiles p
  where auth.uid() is not null
    and char_length(trim(coalesce(p_prefix, ''))) >= 2
    and p.username is not null
    and p.username like
        replace(replace(replace(lower(trim(p_prefix)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        escape '\'
    and p.id <> auth.uid()
    and not private.is_blocked_between(auth.uid(), p.id)
  order by p.username
  limit 20
$$;

-- ---------------------------------------------------------------------------
-- function privileges (Supabase grants EXECUTE on new functions to anon by default)
-- ---------------------------------------------------------------------------
revoke all on function private.is_blocked_between(uuid, uuid) from public, anon;
revoke all on function private.can_view_workout(uuid) from public, anon;
revoke all on function private.follows_guard() from public, anon, authenticated;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;
grant execute on function private.can_view_workout(uuid) to authenticated;

revoke all on function public.get_feed(int, timestamptz, uuid) from public, anon;
revoke all on function public.get_profile_summary(uuid) from public, anon;
revoke all on function public.search_profiles(text) from public, anon;
grant execute on function public.get_feed(int, timestamptz, uuid) to authenticated;
grant execute on function public.get_profile_summary(uuid) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
