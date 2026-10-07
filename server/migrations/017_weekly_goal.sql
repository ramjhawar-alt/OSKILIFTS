-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 9: a private weekly workout goal (days per week).
-- Requires 002. Visible only to its owner: no other function reads this table.
-- The table has no direct access; everything goes through the functions below.

create table if not exists public.user_goals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_days smallint not null check (weekly_days between 1 and 7),
  updated_at timestamptz not null default now()
);

alter table public.user_goals enable row level security;
revoke all on public.user_goals from public, anon, authenticated;

-- p_days 1..7 sets the goal; null or 0 clears it. Anything else is rejected.
create or replace function public.set_weekly_goal(p_days int)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_days is null or p_days = 0 then
    delete from public.user_goals g where g.user_id = auth.uid();
    return;
  end if;
  if p_days < 1 or p_days > 7 then
    raise exception 'invalid_goal';
  end if;
  insert into public.user_goals (user_id, weekly_days)
  values (auth.uid(), p_days)
  on conflict (user_id) do update set weekly_days = excluded.weekly_days, updated_at = now();
end;
$$;

-- My goal, or null if I haven't set one.
create or replace function public.get_weekly_goal()
returns int
language sql stable security definer
set search_path = ''
as $$
  select g.weekly_days::int from public.user_goals g where g.user_id = auth.uid()
$$;

revoke all on function public.set_weekly_goal(int) from public, anon;
revoke all on function public.get_weekly_goal() from public, anon;
grant execute on function public.set_weekly_goal(int) to authenticated;
grant execute on function public.get_weekly_goal() to authenticated;

notify pgrst, 'reload schema';
