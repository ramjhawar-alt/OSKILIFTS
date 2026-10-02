-- Run once in Supabase SQL editor (Dashboard → SQL → New query).
-- Additive only: does not touch capacity_snapshots.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Berkeley-only signups (defense in depth; the app also checks client-side)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_berkeley_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is null or lower(new.email) not like '%@berkeley.edu' then
    raise exception 'Only @berkeley.edu email addresses can sign up';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_berkeley_email_trigger on auth.users;
create trigger enforce_berkeley_email_trigger
  before insert on auth.users
  for each row execute function public.enforce_berkeley_email();

-- ---------------------------------------------------------------------------
-- profiles (one row per user, created by trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  day_type jsonb not null,
  exercises jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);

alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own" on public.workouts
  for select using (auth.uid() = user_id);

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own" on public.workouts
  for insert with check (auth.uid() = user_id);

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own" on public.workouts
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- custom_exercises / custom_day_types (normalized so duplicate prevention is
-- atomic when the same account is used from multiple devices)
-- ---------------------------------------------------------------------------
create table if not exists public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  created_at timestamptz not null default now()
);

create unique index if not exists custom_exercises_user_name_idx
  on public.custom_exercises (user_id, lower(name));

alter table public.custom_exercises enable row level security;

drop policy if exists "custom_exercises_select_own" on public.custom_exercises;
create policy "custom_exercises_select_own" on public.custom_exercises
  for select using (auth.uid() = user_id);

drop policy if exists "custom_exercises_insert_own" on public.custom_exercises;
create policy "custom_exercises_insert_own" on public.custom_exercises
  for insert with check (auth.uid() = user_id);

drop policy if exists "custom_exercises_update_own" on public.custom_exercises;
create policy "custom_exercises_update_own" on public.custom_exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "custom_exercises_delete_own" on public.custom_exercises;
create policy "custom_exercises_delete_own" on public.custom_exercises
  for delete using (auth.uid() = user_id);

create table if not exists public.custom_day_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists custom_day_types_user_name_idx
  on public.custom_day_types (user_id, lower(name));

alter table public.custom_day_types enable row level security;

drop policy if exists "custom_day_types_select_own" on public.custom_day_types;
create policy "custom_day_types_select_own" on public.custom_day_types
  for select using (auth.uid() = user_id);

drop policy if exists "custom_day_types_insert_own" on public.custom_day_types;
create policy "custom_day_types_insert_own" on public.custom_day_types
  for insert with check (auth.uid() = user_id);

drop policy if exists "custom_day_types_update_own" on public.custom_day_types;
create policy "custom_day_types_update_own" on public.custom_day_types
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "custom_day_types_delete_own" on public.custom_day_types;
create policy "custom_day_types_delete_own" on public.custom_day_types
  for delete using (auth.uid() = user_id);
