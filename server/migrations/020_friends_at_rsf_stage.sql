-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- "Friends at the RSF" screen: each friend's bear stage next to their name.
-- Requires 004, 010 (private.are_friends) and 013 (rsf_presence).
--
-- A friend's stage comes from their workout streak, counted ONLY over workouts they share
-- with followers (the same ones their profile already shows friends), so this reveals
-- nothing a friend couldn't already see. The streak is training days in a row with up to two
-- rest days allowed between workouts (see src/domain/streak.ts), and one stage per 10 workouts
-- (see src/services/bearStreakService.ts), capped at 10. "Today" is Berkeley's date.
--
-- get_friends_at_rsf() from 013 is left exactly as it was: the app asks for the new
-- function first and falls back to the old one, so run order doesn't matter.

create or replace function private.shared_bear_stage(p_user uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'America/Los_Angeles')::date as d
  ),
  days as (
    select distinct (w.date at time zone 'UTC')::date as d
    from public.workouts w, today t
    where w.user_id = p_user
      and w.visibility = 'followers'
      and (w.date at time zone 'UTC')::date <= t.d
  ),
  gaps as (
    -- newest first: the gap is how many days after this one the next-newer workout was
    select d, lag(d) over (order by d desc) - d as gap from days
  ),
  islands as (
    select d, sum(case when gap > 3 then 1 else 0 end) over (order by d desc) as grp from gaps
  ),
  streak as (
    select case
             when (select max(d) from days) < (select d from today) - 3 then 0
             else (select count(*) from islands where grp = 0)
           end::int as n
  )
  select least(10, (select n from streak) / 10 + 1)
$$;

-- Friends at the RSF now, longest-there first, with their bear stage (1-10).
create or replace function public.get_friends_at_rsf_stages()
returns table (
  id uuid,
  username text,
  display_name text,
  arrived_at timestamptz,
  expires_at timestamptz,
  stage int
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, r.arrived_at, r.expires_at,
         private.shared_bear_stage(p.id)
  from public.rsf_presence r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.expires_at > now()
    and p.username is not null
    and private.are_friends(auth.uid(), r.user_id)
  order by r.arrived_at, r.user_id
  limit 50
$$;

revoke all on function private.shared_bear_stage(uuid) from public, anon, authenticated;
revoke all on function public.get_friends_at_rsf_stages() from public, anon;
grant execute on function public.get_friends_at_rsf_stages() to authenticated;

notify pgrst, 'reload schema';
