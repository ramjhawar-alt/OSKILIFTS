-- Run once in Supabase SQL editor (Dashboard → SQL → New query). Idempotent.
-- Phase 4, step 1: tappable followers / following lists.
-- Requires 004 and 005.
--
-- Privacy model (same as workouts): the follows table stays visible only to its
-- two parties. A person's lists are readable through this SECURITY DEFINER
-- function, and only by that person or by someone they have accepted as a
-- follower. Everyone else gets zero rows (the counts on a profile stay public,
-- as before). Anyone blocked in either direction is hidden from the list, and a
-- user who blocked the caller (or was blocked by them) returns nothing at all.

create or replace function public.get_connections(
  p_user uuid,
  p_kind text,
  p_limit int default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  username text,
  display_name text,
  relationship text,
  created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  with allowed as (
    select 1
    where auth.uid() is not null
      and p_kind in ('followers', 'following')
      and (
        p_user = auth.uid()
        or (
          exists (select 1 from public.follows f
                  where f.follower_id = auth.uid()
                    and f.followee_id = p_user
                    and f.status = 'accepted')
          and not private.is_blocked_between(auth.uid(), p_user)
        )
      )
  ),
  edges as (
    select
      case when p_kind = 'followers' then f.follower_id else f.followee_id end as other_id,
      f.created_at
    from public.follows f
    where f.status = 'accepted'
      and exists (select 1 from allowed)
      and (
        (p_kind = 'followers' and f.followee_id = p_user)
        or (p_kind = 'following' and f.follower_id = p_user)
      )
  )
  select
    p.id, p.username, p.display_name,
    case
      when p.id = auth.uid() then 'self'
      when exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followee_id = p.id
                     and f.status = 'accepted') then 'following'
      when exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followee_id = p.id
                     and f.status = 'pending') then 'pending_out'
      when exists (select 1 from public.follows f
                   where f.follower_id = p.id and f.followee_id = auth.uid()
                     and f.status = 'pending') then 'pending_in'
      else 'none'
    end,
    e.created_at
  from edges e
  join public.profiles p on p.id = e.other_id
  where p.username is not null
    and (p.id = auth.uid() or not private.is_blocked_between(auth.uid(), p.id))
    and (p_before_created_at is null
         or (e.created_at, p.id) < (p_before_created_at, p_before_id))
  order by e.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.get_connections(uuid, text, int, timestamptz, uuid) from public, anon;
grant execute on function public.get_connections(uuid, text, int, timestamptz, uuid) to authenticated;

notify pgrst, 'reload schema';
