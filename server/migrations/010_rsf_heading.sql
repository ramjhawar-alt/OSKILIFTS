-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 3: "Heading to the RSF" status, and the friends helper.
-- Requires 004 and 005.
--
-- "Friends" = two people who each have an ACCEPTED follow on the other and
-- neither has blocked the other. Only friends can see that you're heading to
-- the RSF. The status expires on its own (default 90 minutes, at most 3 hours).
--
-- The table has no direct access for anyone; everything goes through the
-- SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------------
-- friends helper (reused by later features, e.g. the basketball friends toggle)
-- ---------------------------------------------------------------------------
create or replace function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_a <> p_b
    and exists (select 1 from public.follows f
                where f.follower_id = p_a and f.followee_id = p_b and f.status = 'accepted')
    and exists (select 1 from public.follows f
                where f.follower_id = p_b and f.followee_id = p_a and f.status = 'accepted')
    and not private.is_blocked_between(p_a, p_b)
$$;

-- ---------------------------------------------------------------------------
-- table
-- ---------------------------------------------------------------------------
create table if not exists public.rsf_heading (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > started_at and expires_at <= started_at + interval '3 hours')
);
create index if not exists rsf_heading_expires_idx on public.rsf_heading (expires_at);

alter table public.rsf_heading enable row level security;
revoke all on public.rsf_heading from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_heading: starts (or restarts) my status. Returns when it expires.
-- ---------------------------------------------------------------------------
create or replace function public.set_heading(p_minutes int default 90)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_minutes int := least(greatest(coalesce(p_minutes, 90), 15), 180);
  v_expires timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_me and p.username is not null) then
    raise exception 'username_required';
  end if;

  -- Opportunistic cleanup so the table stays tiny.
  delete from public.rsf_heading h where h.expires_at < now() - interval '1 day';

  insert into public.rsf_heading (user_id, started_at, expires_at)
  values (v_me, now(), now() + make_interval(mins => v_minutes))
  on conflict (user_id) do update
    set started_at = excluded.started_at, expires_at = excluded.expires_at
  returning expires_at into v_expires;

  return v_expires;
end;
$$;

create or replace function public.clear_heading()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.rsf_heading h where h.user_id = auth.uid();
end;
$$;

-- My own active status (null if none or expired).
create or replace function public.get_my_heading()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select h.expires_at
  from public.rsf_heading h
  where h.user_id = auth.uid() and h.expires_at > now()
$$;

-- Friends who are heading to the RSF right now, most recent first.
create or replace function public.get_friends_heading()
returns table (
  id uuid,
  username text,
  display_name text,
  started_at timestamptz,
  expires_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, h.started_at, h.expires_at
  from public.rsf_heading h
  join public.profiles p on p.id = h.user_id
  where auth.uid() is not null
    and h.expires_at > now()
    and p.username is not null
    and private.are_friends(auth.uid(), h.user_id)
  order by h.started_at desc
  limit 50
$$;

-- ---------------------------------------------------------------------------
-- function privileges (Supabase grants EXECUTE on new functions to anon)
-- ---------------------------------------------------------------------------
revoke all on function private.are_friends(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated;

revoke all on function public.set_heading(int) from public, anon;
revoke all on function public.clear_heading() from public, anon;
revoke all on function public.get_my_heading() from public, anon;
revoke all on function public.get_friends_heading() from public, anon;
grant execute on function public.set_heading(int) to authenticated;
grant execute on function public.clear_heading() to authenticated;
grant execute on function public.get_my_heading() to authenticated;
grant execute on function public.get_friends_heading() to authenticated;

notify pgrst, 'reload schema';
