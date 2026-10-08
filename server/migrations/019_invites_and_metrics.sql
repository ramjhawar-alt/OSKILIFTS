-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 5: invite links (resolve a username, record who invited whom) and an
-- admin-only metrics function for the dashboard.
-- Requires 002, 004, 005, 010, 011, 012, 013, 014, 015, 017, 018.
--
-- Invites: a link is just /u/<username>. These functions only look up a PUBLIC
-- fact (that a username exists) for a signed-in user, hide anyone blocked in
-- either direction, and record at most one inviter per new account.
-- Metrics: counts only, admins only. No workout content, no messages, no emails.

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  invitee_id uuid primary key references public.profiles(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index if not exists invites_inviter_idx on public.invites (inviter_id);
alter table public.invites enable row level security;
revoke all on public.invites from public, anon, authenticated;

-- Who is behind /u/<username>? Null when there is no such person, or they are
-- blocked either way with me. Exact (lowercase) match only; this is not a search.
create or replace function public.resolve_username(p_username text)
returns table (id uuid, username text, display_name text, is_public boolean)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.is_public
  from public.profiles p
  where auth.uid() is not null
    and p.username is not null
    and p.username = lower(btrim(coalesce(p_username, '')))
    and (p.id = auth.uid() or not private.is_blocked_between(auth.uid(), p.id))
$$;

-- "I joined through <inviter>'s link." Counts only for a NEW account (created in
-- the last 7 days, so existing users clicking a friend's link aren't conversions),
-- only once per account, never yourself, never across a block. Returns whether it
-- was recorded.
create or replace function public.record_invite(p_inviter_username text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
  v_rows int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = v_me and p.username is not null and p.created_at > now() - interval '7 days') then
    return false;
  end if;
  select p.id into v_inviter
  from public.profiles p
  where p.username = lower(btrim(coalesce(p_inviter_username, ''))) and p.username is not null;
  if v_inviter is null or v_inviter = v_me or private.is_blocked_between(v_me, v_inviter) then
    return false;
  end if;
  insert into public.invites (invitee_id, inviter_id) values (v_me, v_inviter)
  on conflict (invitee_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin metrics: one JSON document for the dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics(p_days int default 30)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 7), 90);
  v_today date := (now() at time zone 'America/Los_Angeles')::date;
  v_since date := v_today - (v_days - 1);
  v_result jsonb;
begin
  if not private.is_admin() then
    raise exception 'not_admin';
  end if;

  with
  workout_days as (
    select w.user_id, (w.date at time zone 'UTC')::date as d from public.workouts w
  ),
  signups as (
    select p.id, (p.created_at at time zone 'America/Los_Angeles')::date as d, p.username is not null as onboarded
    from public.profiles p
  ),
  cohort as (select * from signups where d >= v_since),
  series as (
    select g::date as day from generate_series(v_since, v_today, interval '1 day') g
  ),
  daily as (
    select s.day,
           (select count(*) from signups x where x.d = s.day) as signups,
           (select count(*) from public.workouts w where (w.date at time zone 'UTC')::date = s.day) as workouts,
           (select count(distinct wd.user_id) from workout_days wd where wd.d = s.day) as active
    from series s
  )
  select jsonb_build_object(
    'days', v_days,
    'generated_at', now(),
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'onboarded', (select count(*) from public.profiles where username is not null),
      'public_accounts', (select count(*) from public.profiles where is_public),
      'workouts', (select count(*) from public.workouts),
      'active_7d', (select count(distinct user_id) from workout_days where d > v_today - 7),
      'active_prev_7d', (select count(distinct user_id) from workout_days where d > v_today - 14 and d <= v_today - 7),
      'follows', (select count(*) from public.follows where status = 'accepted'),
      'open_reports', (select count(*) from public.reports where status = 'open')
    ),
    'adoption', jsonb_build_object(
      'leaderboard', (select count(*) from public.leaderboard_members),
      'weekly_recap', (select count(*) from public.email_preferences where weekly_digest),
      'weekly_goals', (select count(*) from public.user_goals),
      'hoopers_now', (select count(*) from public.hoopers_checkins where expires_at > now()),
      'at_rsf_now', (select count(*) from public.rsf_presence where expires_at > now()),
      'heading_now', (select count(*) from public.rsf_heading where expires_at > now())
    ),
    'funnel', jsonb_build_object(
      'signups', (select count(*) from cohort),
      'onboarded', (select count(*) from cohort where onboarded),
      'logged_workout', (select count(*) from cohort c where exists (select 1 from workout_days wd where wd.user_id = c.id)),
      'followed_someone', (select count(*) from cohort c where exists (select 1 from public.follows f where f.follower_id = c.id)),
      'returned_after_week', (select count(*) from cohort c where exists (select 1 from workout_days wd where wd.user_id = c.id and wd.d >= c.d + 7))
    ),
    'invites', jsonb_build_object(
      'total', (select count(*) from public.invites),
      'in_period', (select count(*) from public.invites where (created_at at time zone 'America/Los_Angeles')::date >= v_since),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('username', t.username, 'count', t.cnt) order by t.cnt desc, t.username)
        from (select p.username, count(*) as cnt
              from public.invites i join public.profiles p on p.id = i.inviter_id
              where p.username is not null
              group by p.username order by count(*) desc, p.username limit 5) t
      ), '[]'::jsonb)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'signups', signups, 'workouts', workouts, 'active', active) order by day) from daily), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- privileges
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_username(text) from public, anon;
revoke all on function public.record_invite(text) from public, anon;
revoke all on function public.admin_metrics(int) from public, anon;
grant execute on function public.resolve_username(text) to authenticated;
grant execute on function public.record_invite(text) to authenticated;
grant execute on function public.admin_metrics(int) to authenticated;

notify pgrst, 'reload schema';
