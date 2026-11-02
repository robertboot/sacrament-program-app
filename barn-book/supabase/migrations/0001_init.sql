-- Barn Book — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create table animals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  species text not null check (species in ('horse','dog','cat')),
  breed text,
  born text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- which treatments this animal is on, and how often
create table schedules (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals on delete cascade,
  treatment text not null,
  interval_days int,              -- null = one-time, no reminder
  active boolean not null default true,
  unique (animal_id, treatment)
);

create table records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animals on delete cascade,
  treatment text not null,
  given_on date not null,
  next_due date,                  -- computed on write from interval_days
  product text,                   -- product name, dose, lot number
  given_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index on records (animal_id, treatment, given_on desc);
create index on schedules (animal_id);

-- Row-level security: a row is visible/writable when it belongs to the
-- signed-in user — direct on animals.user_id, via the animal for the rest.

alter table animals enable row level security;
alter table schedules enable row level security;
alter table records enable row level security;

create policy "own animals" on animals
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own schedules" on schedules
  for all
  using (exists (
    select 1 from animals a
    where a.id = schedules.animal_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from animals a
    where a.id = schedules.animal_id and a.user_id = (select auth.uid())
  ));

create policy "own records" on records
  for all
  using (exists (
    select 1 from animals a
    where a.id = records.animal_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from animals a
    where a.id = records.animal_id and a.user_id = (select auth.uid())
  ));
