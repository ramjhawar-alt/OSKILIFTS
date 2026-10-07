-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 6: "At the RSF" presence (friends only).
-- Requires 004, 005 and 010 (private.are_friends).
--
-- The app decides on the phone whether you're inside the RSF's geofence and
-- tells the server only "at the RSF" (never coordinates; there is no column for
-- them). The status lasts 25 minutes and is refreshed while the app is open and
-- you are still there. Only friends (mutual accepted follows, no blocks) can see
-- it. Arriving also ends your "heading to the RSF" status.
-- The table has no direct access; everything goes through the functions below.

create table if not exists public.rsf_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  arrived_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > arrived_at and expires_at <= arrived_at + interval '12 hours')
);
create index if not exists rsf_presence_expires_idx on public.rsf_presence (expires_at);

alter table public.rsf_presence enable row level security;
revoke all on public.rsf_presence from public, anon, authenticated;

-- Marks me as at the RSF for 25 more minutes. Calling it again while still there
-- keeps the original arrival time. Returns when it expires.
create or replace function public.set_at_rsf()
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

  delete from public.rsf_presence r where r.expires_at < now() - interval '1 day';

  insert into public.rsf_presence (user_id, arrived_at, expires_at)
  values (v_me, now(), now() + interval '25 minutes')
  on conflict (user_id) do update
    set arrived_at = case when public.rsf_presence.expires_at > now()
                          then public.rsf_presence.arrived_at
                          else now() end,
        expires_at = now() + interval '25 minutes'
  returning expires_at into v_expires;

  -- I've arrived: the "heading over" status is done.
  delete from public.rsf_heading h where h.user_id = v_me;

  return v_expires;
end;
$$;

create or replace function public.clear_at_rsf()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.rsf_presence r where r.user_id = auth.uid();
end;
$$;

-- When my own presence ends (null if I'm not marked as there).
create or replace function public.get_my_rsf_presence()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select r.expires_at from public.rsf_presence r
  where r.user_id = auth.uid() and r.expires_at > now()
$$;

-- Friends who are at the RSF right now, longest-there first.
create or replace function public.get_friends_at_rsf()
returns table (
  id uuid,
  username text,
  display_name text,
  arrived_at timestamptz,
  expires_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, r.arrived_at, r.expires_at
  from public.rsf_presence r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.expires_at > now()
    and p.username is not null
    and private.are_friends(auth.uid(), r.user_id)
  order by r.arrived_at, r.user_id
  limit 50
$$;

revoke all on function public.set_at_rsf() from public, anon;
revoke all on function public.clear_at_rsf() from public, anon;
revoke all on function public.get_my_rsf_presence() from public, anon;
revoke all on function public.get_friends_at_rsf() from public, anon;
grant execute on function public.set_at_rsf() to authenticated;
grant execute on function public.clear_at_rsf() to authenticated;
grant execute on function public.get_my_rsf_presence() to authenticated;
grant execute on function public.get_friends_at_rsf() to authenticated;

notify pgrst, 'reload schema';
