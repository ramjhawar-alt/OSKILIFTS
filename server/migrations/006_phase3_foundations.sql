-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 3, step 1: weight unit preference, custom exercise types, size limits.
-- Requires 002-005.
--
-- Before running, you can see how big your largest workout rows are today:
--   select id, octet_length(exercises::text) as bytes
--   from public.workouts order by 2 desc limit 5;
-- (The limits below are far above anything normal; old rows are grandfathered.)

-- ---------------------------------------------------------------------------
-- profiles.weight_unit
-- NOTE: migration 003 revokes table-level UPDATE on profiles and re-grants only
-- (username, display_name, terms_version). Re-running 003 AFTER this migration
-- would drop the grant below; if you ever do, run this file again.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists weight_unit text not null default 'lb';
alter table public.profiles drop constraint if exists profiles_weight_unit_check;
alter table public.profiles add constraint profiles_weight_unit_check
  check (weight_unit in ('lb', 'kg'));
grant update (weight_unit) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- custom exercise type (weight x reps, bodyweight reps, duration, distance)
-- ---------------------------------------------------------------------------
alter table public.custom_exercises
  add column if not exists exercise_type text not null default 'weight_reps';
alter table public.custom_exercises drop constraint if exists custom_exercises_type_check;
alter table public.custom_exercises add constraint custom_exercises_type_check
  check (exercise_type in ('weight_reps', 'bodyweight_reps', 'duration', 'distance_duration'));

-- ---------------------------------------------------------------------------
-- workouts size/shape limits (abuse control: get_feed ships this jsonb to
-- every follower). NOT VALID so existing rows are grandfathered and the
-- migration can't fail on old data; new inserts and updates are checked.
-- (An UPDATE of an old oversized row is checked too, so it must be trimmed first.)
-- ---------------------------------------------------------------------------
alter table public.workouts drop constraint if exists workouts_exercises_shape;
alter table public.workouts add constraint workouts_exercises_shape check (
  jsonb_typeof(exercises) = 'array'
  and jsonb_array_length(exercises) <= 60
  and octet_length(exercises::text) <= 120000
  and not jsonb_path_exists(exercises, '$[*] ? (@.log.size() > 60)')
) not valid;

alter table public.workouts drop constraint if exists workouts_notes_length;
alter table public.workouts add constraint workouts_notes_length
  check (notes is null or char_length(notes) <= 2000) not valid;

alter table public.workouts drop constraint if exists workouts_day_type_size;
alter table public.workouts add constraint workouts_day_type_size
  check (octet_length(day_type::text) <= 300) not valid;

notify pgrst, 'reload schema';
