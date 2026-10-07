-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 4: Public / Private accounts, Explore, profile workout lists.
-- Requires 003, 004, 005 and 008.
--
-- Model (TikTok / Instagram style):
--   * profiles.is_public. Everyone starts PRIVATE (default false); only the
--     account owner can change it.
--   * Following a PUBLIC account is instant (status 'accepted'); following a
--     private one is still a request. A trigger decides, never the client.
--   * Switching Private -> Public accepts the requests waiting on you.
--     Switching back keeps existing followers.
--   * A workout marked 'followers' ("shared") is visible to approved followers,
--     and to every signed-in user when its owner is public. 'private' workouts
--     are only ever visible to their owner. `workouts` itself stays owner-only;
--     other people read workouts only through the SECURITY DEFINER functions.
--   * Friends (private.are_friends, from 010) = mutual accepted follows.
--
-- NOTE: this migration replaces private.can_view_workout, get_profile_summary
-- (new `is_public` column) and get_connections. Re-running 004 or 008 later
-- restores the stricter old versions (safe, but public accounts stop working
-- until this file is run again; 004 re-run will also error on the summary's
-- changed return type, which is harmless). Re-running 003 revokes the column
-- grant below; run this file again if so.

-- ---------------------------------------------------------------------------
-- profiles.is_public
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_public boolean not null default false;
grant update (is_public) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- follows: public accounts accept instantly. For requests made through the API
-- (roles authenticated / anon) the trigger OVERWRITES status, so a client can
-- never pick its own. Direct SQL (dashboard, service role) is trusted as-is.
-- The insert policy is the second lock: 'accepted' is allowed only when the
-- person being followed really is public, so even if the trigger were bypassed
-- nobody could approve themselves on a private account.
-- ---------------------------------------------------------------------------
create or replace function private.follows_autoaccept()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) in ('authenticated', 'anon') then
    new.status := case
      when exists (select 1 from public.profiles p where p.id = new.followee_id and p.is_public)
        then 'accepted'
      else 'pending'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists follows_autoaccept_trigger on public.follows;
create trigger follows_autoaccept_trigger
  before insert on public.follows
  for each row execute function private.follows_autoaccept();

drop policy if exists "follows_insert_request" on public.follows;
create policy "follows_insert_request" on public.follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and (
      status = 'pending'
      or exists (select 1 from public.profiles p where p.id = followee_id and p.is_public)
    )
  );

-- Going public approves everyone who was waiting.
create or replace function private.profiles_public_switch()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.is_public and not old.is_public then
    update public.follows f set status = 'accepted'
    where f.followee_id = new.id and f.status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_public_switch_trigger on public.profiles;
create trigger profiles_public_switch_trigger
  after update of is_public on public.profiles
  for each row execute function private.profiles_public_switch();

-- ---------------------------------------------------------------------------
-- can_view_workout: owner; or a shared workout whose owner is public or who has
-- accepted me; never across a block; never for signed-out callers.
-- ---------------------------------------------------------------------------
create or replace function private.can_view_workout(p_workout uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.workouts w
    join public.profiles p on p.id = w.user_id
    where w.id = p_workout
      and (
        w.user_id = auth.uid()
        or (
          w.visibility = 'followers'
          and (
            p.is_public
            or exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid()
                and f.followee_id = w.user_id
                and f.status = 'accepted'
            )
          )
          and not private.is_blocked_between(auth.uid(), w.user_id)
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- get_profile_summary: now says whether the account is public, and shows the
-- shared-workout count/dates of a public account to anyone.
-- (Return type changed, so the old function is dropped first.)
-- ---------------------------------------------------------------------------
drop function if exists public.get_profile_summary(uuid);
create function public.get_profile_summary(p_user uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  follower_count bigint,
  following_count bigint,
  relationship text,
  workout_count bigint,
  workout_dates timestamptz[],
  is_public boolean,
  follows_you boolean
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
    case when rel.r in ('self', 'following') or p.is_public then
      (select count(*) from public.workouts w
       where w.user_id = p.id and (rel.r = 'self' or w.visibility = 'followers'))
    end,
    case when rel.r in ('self', 'following') or p.is_public then
      array(select w.date from public.workouts w
            where w.user_id = p.id and (rel.r = 'self' or w.visibility = 'followers')
            order by w.date desc limit 400)
    end,
    p.is_public,
    exists (select 1 from public.follows f
            where f.follower_id = p.id and f.followee_id = auth.uid() and f.status = 'accepted')
  from public.profiles p
  cross join rel
  where p.id = p_user
    and auth.uid() is not null
    and (p.id = auth.uid() or not private.is_blocked_between(auth.uid(), p.id))
$$;

-- ---------------------------------------------------------------------------
-- get_connections (from 008): a public account's lists are open to everyone.
-- ---------------------------------------------------------------------------
create or replace function public.get_connections(
  p_user uuid,
  p_kind text,
  p_limit int default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  username text,
  display_name text,
  relationship text,
  created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  with allowed as (
    select 1
    where auth.uid() is not null
      and p_kind in ('followers', 'following')
      and (
        p_user = auth.uid()
        or (
          (
            exists (select 1 from public.follows f
                    where f.follower_id = auth.uid()
                      and f.followee_id = p_user
                      and f.status = 'accepted')
            or exists (select 1 from public.profiles pp where pp.id = p_user and pp.is_public)
          )
          and not private.is_blocked_between(auth.uid(), p_user)
        )
      )
  ),
  edges as (
    select
      case when p_kind = 'followers' then f.follower_id else f.followee_id end as other_id,
      f.created_at
    from public.follows f
    where f.status = 'accepted'
      and exists (select 1 from allowed)
      and (
        (p_kind = 'followers' and f.followee_id = p_user)
        or (p_kind = 'following' and f.follower_id = p_user)
      )
  )
  select
    p.id, p.username, p.display_name,
    case
      when p.id = auth.uid() then 'self'
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
    end,
    e.created_at
  from edges e
  join public.profiles p on p.id = e.other_id
  where p.username is not null
    and (p.id = auth.uid() or not private.is_blocked_between(auth.uid(), p.id))
    and (p_before_created_at is null
         or (e.created_at, p.id) < (p_before_created_at, p_before_id))
  order by e.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- ---------------------------------------------------------------------------
-- get_user_workouts: the workouts on someone's profile page, newest first, in
-- the same shape as get_feed. Exactly the ones the caller may see (all of your
-- own; for others, only shared workouts of public / approved accounts).
-- ---------------------------------------------------------------------------
create or replace function public.get_user_workouts(
  p_user uuid,
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
  liked_by_me boolean,
  visibility text
)
language sql stable security definer
set search_path = ''
as $$
  select
    w.id, w.user_id, p.username, p.display_name, w.date, w.day_type,
    w.exercises, w.notes, w.created_at,
    (select count(*) from public.workout_likes l where l.workout_id = w.id),
    exists (select 1 from public.workout_likes l
            where l.workout_id = w.id and l.user_id = auth.uid()),
    w.visibility
  from public.workouts w
  join public.profiles p on p.id = w.user_id
  where w.user_id = p_user
    and auth.uid() is not null
    and private.can_view_workout(w.id)
    and (p_before_created_at is null
         or (w.created_at, w.id) < (p_before_created_at, p_before_id))
  order by w.created_at desc, w.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- get_explore: recent shared workouts from PUBLIC accounts (last 30 days),
-- newest first. Never your own, never across a block.
-- ---------------------------------------------------------------------------
create index if not exists workouts_explore_idx
  on public.workouts (created_at desc, id desc)
  where visibility = 'followers';

create or replace function public.get_explore(
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
    (select count(*) from public.workout_likes l where l.workout_id = w.id),
    exists (select 1 from public.workout_likes l
            where l.workout_id = w.id and l.user_id = auth.uid())
  from public.workouts w
  join public.profiles p on p.id = w.user_id
  where auth.uid() is not null
    and w.visibility = 'followers'
    and p.is_public
    and p.username is not null
    and w.user_id <> auth.uid()
    and w.created_at > now() - interval '30 days'
    and (p_before_created_at is null
         or (w.created_at, w.id) < (p_before_created_at, p_before_id))
    and not private.is_blocked_between(auth.uid(), w.user_id)
  order by w.created_at desc, w.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- function privileges (Supabase grants EXECUTE on new functions to anon)
-- ---------------------------------------------------------------------------
revoke all on function private.follows_autoaccept() from public, anon, authenticated;
revoke all on function private.profiles_public_switch() from public, anon, authenticated;
revoke all on function private.can_view_workout(uuid) from public, anon;
grant execute on function private.can_view_workout(uuid) to authenticated;

revoke all on function public.get_profile_summary(uuid) from public, anon;
revoke all on function public.get_connections(uuid, text, int, timestamptz, uuid) from public, anon;
revoke all on function public.get_user_workouts(uuid, int, timestamptz, uuid) from public, anon;
revoke all on function public.get_explore(int, timestamptz, uuid) from public, anon;
grant execute on function public.get_profile_summary(uuid) to authenticated;
grant execute on function public.get_connections(uuid, text, int, timestamptz, uuid) to authenticated;
grant execute on function public.get_user_workouts(uuid, int, timestamptz, uuid) to authenticated;
grant execute on function public.get_explore(int, timestamptz, uuid) to authenticated;

notify pgrst, 'reload schema';
