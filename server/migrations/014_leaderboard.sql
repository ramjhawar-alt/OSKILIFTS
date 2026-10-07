-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 7: friends-only weekly leaderboard (days trained this week).
-- Requires 002 and 010 (private.are_friends).
--
-- Opt-in on both sides: you appear on friends' boards only if you joined, and you
-- only see the board once you've joined yourself. Friends = mutual accepted
-- follows with no block. The score is the number of DIFFERENT DAYS you logged a
-- workout this week (Monday to Sunday, Pacific time), so it can't be inflated by
-- logging many workouts in a day, and it never reveals weights, exercises, or
-- which workouts exist. Joining means friends see your day count, even when the
-- workouts themselves are Private.
-- The table has no direct access; everything goes through the functions below.

create table if not exists public.leaderboard_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.leaderboard_members enable row level security;
revoke all on public.leaderboard_members from public, anon, authenticated;

create or replace function public.join_leaderboard()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.username is not null) then
    raise exception 'username_required';
  end if;
  insert into public.leaderboard_members (user_id) values (auth.uid()) on conflict do nothing;
end;
$$;

create or replace function public.leave_leaderboard()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.leaderboard_members m where m.user_id = auth.uid();
end;
$$;

create or replace function public.am_i_on_leaderboard()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.leaderboard_members m where m.user_id = auth.uid())
$$;

-- This week's board: me plus the friends who joined, most days first. Empty unless
-- I have joined. Workout dates are stored at noon UTC on the local calendar day,
-- so the UTC date IS the day the person picked.
create or replace function public.get_weekly_leaderboard()
returns table (
  id uuid,
  username text,
  display_name text,
  days int,
  is_me boolean
)
language sql stable security definer
set search_path = ''
as $$
  with week as (
    select (date_trunc('week', now() at time zone 'America/Los_Angeles'))::date as start_day
  ),
  board as (
    select m.user_id
    from public.leaderboard_members m
    where auth.uid() is not null
      and exists (select 1 from public.leaderboard_members me where me.user_id = auth.uid())
      and (m.user_id = auth.uid() or private.are_friends(auth.uid(), m.user_id))
  )
  select p.id, p.username, p.display_name,
         (select count(distinct (w.date at time zone 'UTC')::date)
            from public.workouts w, week
           where w.user_id = b.user_id
             and (w.date at time zone 'UTC')::date >= week.start_day
             and (w.date at time zone 'UTC')::date < week.start_day + 7)::int as days,
         (b.user_id = auth.uid()) as is_me
  from board b
  join public.profiles p on p.id = b.user_id
  where p.username is not null
  order by days desc, p.username
  limit 25
$$;

revoke all on function public.join_leaderboard() from public, anon;
revoke all on function public.leave_leaderboard() from public, anon;
revoke all on function public.am_i_on_leaderboard() from public, anon;
revoke all on function public.get_weekly_leaderboard() from public, anon;
grant execute on function public.join_leaderboard() to authenticated;
grant execute on function public.leave_leaderboard() to authenticated;
grant execute on function public.am_i_on_leaderboard() to authenticated;
grant execute on function public.get_weekly_leaderboard() to authenticated;

notify pgrst, 'reload schema';
