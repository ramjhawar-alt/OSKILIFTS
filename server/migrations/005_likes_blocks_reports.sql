-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 2, step 3: likes, blocks, reports, account deletion.
-- Requires 002, 003 and 004.

-- ---------------------------------------------------------------------------
-- workout_likes
-- ---------------------------------------------------------------------------
create table if not exists public.workout_likes (
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);
create index if not exists workout_likes_user_idx on public.workout_likes (user_id);

alter table public.workout_likes enable row level security;
revoke all on public.workout_likes from anon;
revoke update, truncate, references, trigger on public.workout_likes from authenticated;

-- You only ever see your own like rows; counts come from get_feed, so who
-- liked what isn't exposed.
drop policy if exists "workout_likes_select_own" on public.workout_likes;
create policy "workout_likes_select_own" on public.workout_likes
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "workout_likes_insert_visible" on public.workout_likes;
create policy "workout_likes_insert_visible" on public.workout_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_workout(workout_id));

drop policy if exists "workout_likes_delete_own" on public.workout_likes;
create policy "workout_likes_delete_own" on public.workout_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon;
revoke update, truncate, references, trigger on public.blocks from authenticated;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Real block lookups (replace the stubs from 003/004). SECURITY DEFINER because
-- `blocks` RLS only shows the blocker's own rows, so "did THEY block ME" is
-- invisible to a policy or invoker query.
create or replace function private.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b)
       or (b.blocker_id = p_b and b.blocked_id = p_a)
  )
$$;

create or replace function private.has_blocked_me(p_other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where b.blocker_id = p_other and b.blocked_id = auth.uid()
  )
$$;

-- Blocking removes the relationship in the same transaction, whichever client
-- path inserted the block. Unblocking restores nothing.
create or replace function private.on_block_created()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.follows f
  where (f.follower_id = new.blocker_id and f.followee_id = new.blocked_id)
     or (f.follower_id = new.blocked_id and f.followee_id = new.blocker_id);

  delete from public.workout_likes l
  using public.workouts w
  where l.workout_id = w.id
    and ((l.user_id = new.blocked_id and w.user_id = new.blocker_id)
      or (l.user_id = new.blocker_id and w.user_id = new.blocked_id));

  return new;
end;
$$;

drop trigger if exists on_block_created_trigger on public.blocks;
create trigger on_block_created_trigger
  after insert on public.blocks
  for each row execute function private.on_block_created();

-- ---------------------------------------------------------------------------
-- get_feed, now with like counts (same signature as 004)
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
    (select count(*) from public.workout_likes l where l.workout_id = w.id) as like_count,
    exists (select 1 from public.workout_likes l
            where l.workout_id = w.id and l.user_id = auth.uid()) as liked_by_me
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
-- reports: no direct table access; written only through submit_report.
-- Review them in the dashboard (Table Editor -> reports, oldest open first).
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('workout', 'profile')),
  target_id uuid not null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text not null
    check (reason in ('harassment', 'hate', 'sexual', 'spam', 'impersonation', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  -- The owner can edit or delete content after it is reported; keep the evidence.
  snapshot jsonb,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create unique index if not exists reports_reporter_target_key
  on public.reports (reporter_id, target_type, target_id);
create index if not exists reports_status_created_idx on public.reports (status, created_at);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id);

alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;

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
-- delete_my_account: removes the auth user; everything else cascades
-- (profile, workouts, follows, likes, blocks, custom items). Reports keep their
-- snapshot, with the reporter/reported user ids set to null.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- function privileges
-- ---------------------------------------------------------------------------
revoke all on function private.is_blocked_between(uuid, uuid) from public, anon;
revoke all on function private.has_blocked_me(uuid) from public, anon;
revoke all on function private.on_block_created() from public, anon, authenticated;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;
grant execute on function private.has_blocked_me(uuid) to authenticated;

revoke all on function public.get_feed(int, timestamptz, uuid) from public, anon;
revoke all on function public.submit_report(text, uuid, text, text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.get_feed(int, timestamptz, uuid) to authenticated;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
