-- Run once in Supabase SQL editor (Dashboard → SQL → New query)

create table if not exists capacity_snapshots (
  id bigserial primary key,
  recorded_at timestamptz not null default now(),
  day_of_week smallint not null,
  hour smallint not null,
  minute smallint not null,
  current_count integer not null,
  max_capacity integer not null,
  percentage real not null,
  is_open boolean not null default true
);

create index if not exists capacity_snapshots_day_hour_idx
  on capacity_snapshots (day_of_week, hour)
  where is_open;

create index if not exists capacity_snapshots_recorded_at_idx
  on capacity_snapshots (recorded_at desc);

comment on table capacity_snapshots is 'RSF weight room occupancy samples for peak-hours analytics';
