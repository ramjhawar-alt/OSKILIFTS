-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 10: opt-in weekly recap email, and a daily admin alert for reports.
-- Requires 004, 005, 009 and 015.
--
-- Principles: nothing is emailed per event; the recap is opt-in (off by default),
-- at most weekly, and only sent when something actually happened; it contains
-- COUNTS (plus up to three new followers' usernames), never workout content or
-- comment text. Every recap carries a one-click unsubscribe link (an unguessable
-- per-user token), which also works without logging in.
--
-- Two kinds of functions:
--   * for signed-in users: get_email_prefs / set_weekly_digest (their own setting only)
--   * for the Render server ONLY (service_role): everything that reads many users'
--     data or addresses. These are revoked from anon and authenticated.

create table if not exists public.email_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_digest boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  last_digest_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_preferences enable row level security;
revoke all on public.email_preferences from public, anon, authenticated;

alter table public.admins add column if not exists last_alerted_at timestamptz;

-- ---------------------------------------------------------------------------
-- signed-in users: their own setting
-- ---------------------------------------------------------------------------
-- decided = they have answered the question at least once (so the Home card stops asking).
create or replace function public.get_email_prefs()
returns table (weekly_digest boolean, decided boolean)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(p.weekly_digest, false), p.user_id is not null
  from (select 1) one
  left join public.email_preferences p on p.user_id = auth.uid()
  where auth.uid() is not null
$$;

create or replace function public.set_weekly_digest(p_on boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_on is null then
    raise exception 'invalid_value';
  end if;
  insert into public.email_preferences (user_id, weekly_digest)
  values (auth.uid(), p_on)
  on conflict (user_id) do update set weekly_digest = excluded.weekly_digest;
end;
$$;

-- ---------------------------------------------------------------------------
-- the recap's numbers for one person since a moment (never called by the app)
-- ---------------------------------------------------------------------------
create or replace function private.digest_payload(p_user uuid, p_since timestamptz)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with fol as (
    select f.follower_id, f.created_at
    from public.follows f
    where f.followee_id = p_user and f.status = 'accepted' and f.created_at > p_since
      and not private.is_blocked_between(p_user, f.follower_id)
  ),
  names as (
    select p.username
    from fol join public.profiles p on p.id = fol.follower_id
    where p.username is not null
    order by fol.created_at desc
    limit 3
  )
  select jsonb_build_object(
    'new_followers', (select count(*) from fol),
    'follower_names', coalesce((select jsonb_agg(username) from names), '[]'::jsonb),
    'pending_requests', (select count(*) from public.follows f
                         where f.followee_id = p_user and f.status = 'pending'
                           and not private.is_blocked_between(p_user, f.follower_id)),
    'likes', (select count(*) from public.workout_likes l
              join public.workouts w on w.id = l.workout_id
              where w.user_id = p_user and l.user_id <> p_user and l.created_at > p_since
                and not private.is_blocked_between(p_user, l.user_id)),
    'comments', (select count(*) from public.workout_comments c
                 join public.workouts w on w.id = c.workout_id
                 where w.user_id = p_user and c.user_id <> p_user and c.created_at > p_since
                   and not private.is_blocked_between(p_user, c.user_id)),
    'days_trained', (select count(distinct (w.date at time zone 'UTC')::date)
                     from public.workouts w
                     where w.user_id = p_user
                       and (w.date at time zone 'UTC')::date > ((now() at time zone 'America/Los_Angeles')::date - 7)),
    'weekly_goal', (select g.weekly_days from public.user_goals g where g.user_id = p_user)
  )
$$;

-- ---------------------------------------------------------------------------
-- server only: who is due a recap, with what
-- ---------------------------------------------------------------------------
-- Opted in, not emailed in the last 6 days, and with real social activity
-- (new followers, waiting follow requests, likes or comments). Window = since the
-- last recap, at most 14 days back.
create or replace function public.digest_candidates(p_limit int default 50)
returns table (
  user_id uuid,
  email text,
  username text,
  display_name text,
  unsubscribe_token uuid,
  payload jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select e.user_id, u.email::text, p.username, p.display_name, e.unsubscribe_token, d.payload
  from public.email_preferences e
  join auth.users u on u.id = e.user_id
  join public.profiles p on p.id = e.user_id
  cross join lateral (
    select private.digest_payload(
      e.user_id,
      greatest(coalesce(e.last_digest_at, now() - interval '7 days'), now() - interval '14 days')
    ) as payload
  ) d
  where e.weekly_digest
    and u.email is not null
    and p.username is not null
    and (e.last_digest_at is null or e.last_digest_at < now() - interval '6 days')
    and ((d.payload->>'new_followers')::int
         + (d.payload->>'pending_requests')::int
         + (d.payload->>'likes')::int
         + (d.payload->>'comments')::int) > 0
  order by e.last_digest_at nulls first, e.user_id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

create or replace function public.digest_mark_sent(p_user uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.email_preferences set last_digest_at = now() where user_id = p_user
$$;

-- One-click unsubscribe by token. Returns whether a subscription was switched off.
create or replace function public.digest_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if p_token is null then
    return false;
  end if;
  update public.email_preferences set weekly_digest = false
  where unsubscribe_token = p_token and weekly_digest;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- server only: the daily alert for admins when reports are waiting
-- ---------------------------------------------------------------------------
create or replace function public.admin_alert_candidates()
returns table (email text, open_count int, oldest_open timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select u.email::text, o.cnt, o.oldest
  from public.admins a
  join auth.users u on u.id = a.user_id
  cross join lateral (
    select count(*)::int as cnt, min(r.created_at) as oldest
    from public.reports r where r.status = 'open'
  ) o
  where o.cnt > 0
    and u.email is not null
    and (a.last_alerted_at is null or a.last_alerted_at < now() - interval '23 hours')
$$;

create or replace function public.admin_alert_mark_sent()
returns void
language sql security definer
set search_path = ''
as $$
  update public.admins set last_alerted_at = now()
$$;

-- ---------------------------------------------------------------------------
-- privileges
-- ---------------------------------------------------------------------------
revoke all on function public.get_email_prefs() from public, anon;
revoke all on function public.set_weekly_digest(boolean) from public, anon;
grant execute on function public.get_email_prefs() to authenticated;
grant execute on function public.set_weekly_digest(boolean) to authenticated;

revoke all on function private.digest_payload(uuid, timestamptz) from public, anon, authenticated;

revoke all on function public.digest_candidates(int) from public, anon, authenticated;
revoke all on function public.digest_mark_sent(uuid) from public, anon, authenticated;
revoke all on function public.digest_unsubscribe(uuid) from public, anon, authenticated;
revoke all on function public.admin_alert_candidates() from public, anon, authenticated;
revoke all on function public.admin_alert_mark_sent() from public, anon, authenticated;
grant execute on function public.digest_candidates(int) to service_role;
grant execute on function public.digest_mark_sent(uuid) to service_role;
grant execute on function public.digest_unsubscribe(uuid) to service_role;
grant execute on function public.admin_alert_candidates() to service_role;
grant execute on function public.admin_alert_mark_sent() to service_role;

notify pgrst, 'reload schema';
