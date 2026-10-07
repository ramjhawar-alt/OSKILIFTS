-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 5: basketball check-ins with real accounts (replaces the anonymous
-- in-memory check-ins on the API server).
-- Requires 004, 005 and 010 (private.are_friends).
--
-- Model: checking in is a deliberate act, so everyone who is checked in is listed
-- by username to every signed-in user, whether their account is public or
-- private. Anyone blocked in either direction is hidden from each other's list.
-- Check-ins expire after 60 minutes (checking in again extends them).
-- The table has no direct access; everything goes through the functions below.

create table if not exists public.hoopers_checkins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > checked_in_at and expires_at <= checked_in_at + interval '2 hours')
);
create index if not exists hoopers_checkins_expires_idx on public.hoopers_checkins (expires_at);

alter table public.hoopers_checkins enable row level security;
revoke all on public.hoopers_checkins from public, anon, authenticated;

create or replace function public.hoopers_check_in()
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_expires timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_me and p.username is not null) then
    raise exception 'username_required';
  end if;

  delete from public.hoopers_checkins c where c.expires_at < now() - interval '1 day';

  insert into public.hoopers_checkins (user_id, checked_in_at, expires_at)
  values (v_me, now(), now() + interval '60 minutes')
  on conflict (user_id) do update
    set checked_in_at = excluded.checked_in_at, expires_at = excluded.expires_at
  returning expires_at into v_expires;

  return v_expires;
end;
$$;

create or replace function public.hoopers_check_out()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.hoopers_checkins c where c.user_id = auth.uid();
end;
$$;

-- When my own check-in ends (null if I'm not checked in).
create or replace function public.get_my_hoopers_checkin()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select c.expires_at from public.hoopers_checkins c
  where c.user_id = auth.uid() and c.expires_at > now()
$$;

-- Everyone playing right now (blocks and block-backs hidden). Friends first, then
-- most recent. Never includes me. p_friends_only keeps only mutual follows.
create or replace function public.get_hoopers(p_friends_only boolean default false)
returns table (
  id uuid,
  username text,
  display_name text,
  checked_in_at timestamptz,
  expires_at timestamptz,
  is_friend boolean
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, c.checked_in_at, c.expires_at,
         private.are_friends(auth.uid(), c.user_id) as is_friend
  from public.hoopers_checkins c
  join public.profiles p on p.id = c.user_id
  where auth.uid() is not null
    and c.expires_at > now()
    and c.user_id <> auth.uid()
    and p.username is not null
    and not private.is_blocked_between(auth.uid(), c.user_id)
    and (not coalesce(p_friends_only, false) or private.are_friends(auth.uid(), c.user_id))
  order by private.are_friends(auth.uid(), c.user_id) desc, c.checked_in_at desc, c.user_id
  limit 100
$$;

-- Total people playing (includes me and people I have blocked: it measures the crowd).
create or replace function public.get_hoopers_count()
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select count(*) from public.hoopers_checkins c
  where auth.uid() is not null and c.expires_at > now()
$$;

revoke all on function public.hoopers_check_in() from public, anon;
revoke all on function public.hoopers_check_out() from public, anon;
revoke all on function public.get_my_hoopers_checkin() from public, anon;
revoke all on function public.get_hoopers(boolean) from public, anon;
revoke all on function public.get_hoopers_count() from public, anon;
grant execute on function public.hoopers_check_in() to authenticated;
grant execute on function public.hoopers_check_out() to authenticated;
grant execute on function public.get_my_hoopers_checkin() to authenticated;
grant execute on function public.get_hoopers(boolean) to authenticated;
grant execute on function public.get_hoopers_count() to authenticated;

notify pgrst, 'reload schema';
