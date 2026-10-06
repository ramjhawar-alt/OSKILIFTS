-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 3, step 2: workout routines (templates). Requires 002-006.
--
-- A routine stores STRUCTURE only (exercises, set types, target reps), never
-- weights: weights come from your previous-session hints when you start one,
-- so a routine never goes stale as you get stronger.

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  day_type jsonb,
  exercises jsonb not null,
  notes text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint routines_notes_len check (notes is null or char_length(notes) <= 500),
  constraint routines_day_type_size check (day_type is null or octet_length(day_type::text) <= 300),
  constraint routines_exercises_shape check (
    jsonb_typeof(exercises) = 'array'
    and jsonb_array_length(exercises) between 1 and 40
    and octet_length(exercises::text) <= 60000
  )
);

create unique index if not exists routines_user_name_key
  on public.routines (user_id, lower(btrim(name)));
create index if not exists routines_user_recent_idx
  on public.routines (user_id, last_used_at desc nulls last, created_at desc);

alter table public.routines enable row level security;
revoke all on public.routines from anon;
revoke truncate, references, trigger on public.routines from authenticated;

drop policy if exists "routines_select_own" on public.routines;
create policy "routines_select_own" on public.routines
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "routines_insert_own" on public.routines;
create policy "routines_insert_own" on public.routines
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "routines_update_own" on public.routines;
create policy "routines_update_own" on public.routines
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "routines_delete_own" on public.routines;
create policy "routines_delete_own" on public.routines
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- user_id and created_at are immutable: a table-level UPDATE grant overrides
-- column grants, so revoke it first.
revoke update on public.routines from authenticated;
grant update (name, day_type, exercises, notes, last_used_at) on public.routines to authenticated;

create or replace function private.routines_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists routines_touch_trigger on public.routines;
create trigger routines_touch_trigger
  before update on public.routines
  for each row execute function private.routines_touch();

-- At most 50 routines per user.
create or replace function private.routines_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.routines r where r.user_id = new.user_id) >= 50 then
    raise exception 'too_many_routines';
  end if;
  return new;
end;
$$;

drop trigger if exists routines_guard_trigger on public.routines;
create trigger routines_guard_trigger
  before insert on public.routines
  for each row execute function private.routines_guard();

revoke all on function private.routines_touch() from public, anon, authenticated;
revoke all on function private.routines_guard() from public, anon, authenticated;

notify pgrst, 'reload schema';
