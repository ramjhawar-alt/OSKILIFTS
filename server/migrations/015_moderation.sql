-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 8: in-app moderation queue for reports.
-- Requires 005 (reports) and 009 (comment reports).
--
-- `admins` lists who may review reports. It has no access from the app at all
-- (add or remove admins only here in the SQL editor). Every moderation function
-- checks it first and refuses everyone else.
-- Actions are deliberately limited and reversible where possible:
--   dismiss / reviewed : just set the report's status
--   remove             : a COMMENT is deleted; a WORKOUT is hidden by setting it to
--                        "only me" (the owner keeps their data); a PROFILE report
--                        can't be removed this way (handle it in the dashboard).

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

-- The project owner is the first admin.
insert into public.admins (user_id)
select u.id from auth.users u where lower(u.email) = 'ram_jhawar@berkeley.edu'
on conflict do nothing;

alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create or replace function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;

create or replace function public.am_i_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.is_admin() $$;

-- Open reports waiting for review; 0 for everyone who isn't an admin.
create or replace function public.admin_open_report_count()
returns int
language sql stable security definer
set search_path = ''
as $$
  select case when private.is_admin()
              then (select count(*)::int from public.reports r where r.status = 'open')
              else 0 end
$$;

-- p_status: 'open' (default), 'resolved' (reviewed/actioned/dismissed), or 'all'. Oldest open first.
create or replace function public.admin_list_reports(p_status text default 'open', p_limit int default 50)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  reporter_username text,
  reported_user_id uuid,
  reported_username text,
  snapshot jsonb,
  reports_against_user int,
  target_exists boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin';
  end if;
  return query
    select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
           rp.username, r.reported_user_id, up.username, r.snapshot,
           (select count(*)::int from public.reports o where o.reported_user_id = r.reported_user_id),
           case r.target_type
             when 'comment' then exists (select 1 from public.workout_comments c where c.id = r.target_id)
             when 'workout' then exists (select 1 from public.workouts w where w.id = r.target_id)
             else exists (select 1 from public.profiles p where p.id = r.target_id)
           end
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles up on up.id = r.reported_user_id
    where case coalesce(p_status, 'open')
            when 'open' then r.status = 'open'
            when 'resolved' then r.status <> 'open'
            else true
          end
    order by case when r.status = 'open' then 0 else 1 end,
             case when r.status = 'open' then r.created_at end asc,
             r.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- p_action: 'dismiss' | 'reviewed' | 'remove'. Other open reports on the same
-- thing get the same outcome.
create or replace function public.admin_resolve_report(p_report uuid, p_action text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_type text;
  v_target uuid;
  v_status text;
begin
  if not private.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_action not in ('dismiss', 'reviewed', 'remove') then
    raise exception 'invalid_action';
  end if;

  select r.target_type, r.target_id into v_type, v_target
  from public.reports r where r.id = p_report;
  if v_type is null then
    raise exception 'report_not_found';
  end if;

  if p_action = 'remove' then
    if v_type = 'comment' then
      delete from public.workout_comments c where c.id = v_target;
    elsif v_type = 'workout' then
      update public.workouts w set visibility = 'private' where w.id = v_target;
    else
      raise exception 'cannot_remove_profile';
    end if;
  end if;

  v_status := case p_action when 'dismiss' then 'dismissed' when 'reviewed' then 'reviewed' else 'actioned' end;

  update public.reports r
     set status = v_status, reviewed_at = now(), reviewed_by = auth.uid()
   where r.status = 'open'
     and (r.id = p_report or (r.target_type = v_type and r.target_id = v_target));
end;
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
revoke all on function public.am_i_admin() from public, anon;
revoke all on function public.admin_open_report_count() from public, anon;
revoke all on function public.admin_list_reports(text, int) from public, anon;
revoke all on function public.admin_resolve_report(uuid, text) from public, anon;
grant execute on function public.am_i_admin() to authenticated;
grant execute on function public.admin_open_report_count() to authenticated;
grant execute on function public.admin_list_reports(text, int) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

notify pgrst, 'reload schema';
