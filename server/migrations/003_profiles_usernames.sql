-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 2, step 1: usernames, terms acceptance, DB-enforced name filter.
-- Requires 002_accounts_and_workouts.sql.

-- ---------------------------------------------------------------------------
-- private schema: helper functions that must not be reachable via the API
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: username + terms
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) between 1 and 40);

-- The format CHECK forces lowercase, so a plain unique index is case-insensitive
-- in effect (the client lowercases input).
create unique index if not exists profiles_username_key on public.profiles (username);
-- Supports `username like 'abc%'` prefix search under non-C collations.
create index if not exists profiles_username_prefix_idx
  on public.profiles (username text_pattern_ops);

-- Users created before this migration might lack a profile row.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- blocked_terms: dashboard-editable list the name filter checks
--   kind 'abuse'    -> rejected if the normalized text CONTAINS the term
--   kind 'reserved' -> rejected if the normalized username EQUALS the term
-- Add rows in Table Editor any time; no redeploy needed.
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_terms (
  term text primary key check (term = lower(term) and term ~ '^[a-z0-9]+$'),
  kind text not null check (kind in ('abuse', 'reserved')),
  created_at timestamptz not null default now()
);

alter table public.blocked_terms enable row level security;
revoke all on public.blocked_terms from public, anon, authenticated;

insert into public.blocked_terms (term, kind) values
  ('admin', 'reserved'), ('administrator', 'reserved'), ('support', 'reserved'),
  ('help', 'reserved'), ('official', 'reserved'), ('staff', 'reserved'),
  ('moderator', 'reserved'), ('mod', 'reserved'), ('root', 'reserved'),
  ('system', 'reserved'), ('settings', 'reserved'), ('me', 'reserved'),
  ('oski', 'reserved'), ('oskilifts', 'reserved'), ('berkeley', 'reserved'),
  ('ucberkeley', 'reserved'), ('calberkeley', 'reserved'), ('cal', 'reserved'),
  ('rsf', 'reserved'), ('recwell', 'reserved'), ('null', 'reserved'),
  ('undefined', 'reserved'), ('anonymous', 'reserved'),
  -- Starter list of unambiguous abuse; extend it from the dashboard. Terms are
  -- matched as substrings, so avoid ones inside real names/words (e.g. 'nazi' is
  -- in 'Nazir', 'kys' is in 'skys'); handle those through reports instead.
  ('fuck', 'abuse'), ('shit', 'abuse'), ('cunt', 'abuse'), ('bitch', 'abuse'),
  ('nigger', 'abuse'), ('nigga', 'abuse'), ('faggot', 'abuse'), ('retard', 'abuse'),
  ('whore', 'abuse'), ('slut', 'abuse'), ('hitler', 'abuse'),
  ('rapist', 'abuse'), ('killyourself', 'abuse')
on conflict (term) do nothing;

-- Lowercase, undo common leetspeak, drop everything that isn't a-z/0-9.
create or replace function private.normalize_handle(p_text text)
returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(
           translate(lower(coalesce(p_text, '')), '013457@$', 'oieastas'),
           '[^a-z0-9]', '', 'g')
$$;

create or replace function private.is_text_allowed(p_text text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.blocked_terms t
    where t.kind = 'abuse'
      and position(t.term in private.normalize_handle(p_text)) > 0
  )
$$;

create or replace function private.is_username_allowed(p_username text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_text_allowed(p_username)
     and not exists (
       select 1 from public.blocked_terms t
       where t.kind = 'reserved'
         and t.term = private.normalize_handle(p_username)
     )
$$;

-- Stub so the profiles SELECT policy can reference it now; 005 replaces the
-- body with a real lookup in `blocks`.
create or replace function private.has_blocked_me(p_other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select false $$;

-- ---------------------------------------------------------------------------
-- profiles guard trigger
-- ---------------------------------------------------------------------------
create or replace function private.profiles_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.username is not null
     and new.username is distinct from old.username then
    raise exception 'username_immutable';
  end if;

  if new.username is not null
     and (tg_op = 'INSERT' or new.username is distinct from old.username) then
    if not private.is_username_allowed(new.username) then
      raise exception 'username_not_allowed';
    end if;
  end if;

  if new.display_name is not null
     and (tg_op = 'INSERT' or new.display_name is distinct from old.display_name) then
    if not private.is_text_allowed(new.display_name) then
      raise exception 'display_name_not_allowed';
    end if;
  end if;

  if new.terms_version is not null
     and (tg_op = 'INSERT' or new.terms_version is distinct from old.terms_version) then
    new.terms_accepted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_trigger on public.profiles;
create trigger profiles_guard_trigger
  before insert or update on public.profiles
  for each row execute function private.profiles_guard();

-- ---------------------------------------------------------------------------
-- profiles access: readable by any signed-in user (needed for search and
-- profile pages), writable only for your own username/display name/terms.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or not private.has_blocked_me(id));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke insert, delete, truncate on public.profiles from authenticated;
-- Table-level UPDATE overrides column grants, so revoke it first.
revoke update on public.profiles from authenticated;
grant update (username, display_name, terms_version) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- function privileges
-- ---------------------------------------------------------------------------
revoke all on function private.normalize_handle(text) from public, anon;
revoke all on function private.is_text_allowed(text) from public, anon;
revoke all on function private.is_username_allowed(text) from public, anon;
revoke all on function private.has_blocked_me(uuid) from public, anon;
revoke all on function private.profiles_guard() from public, anon, authenticated;
grant execute on function private.has_blocked_me(uuid) to authenticated;
