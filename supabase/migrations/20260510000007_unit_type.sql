-- Unit type: ward or branch. Affects the title used for the senior bishopric
-- member ("Bishop" vs "Branch President") and the label on the business
-- section ("Ward Business" vs "Branch Business"). Default is 'branch' so
-- existing rows match this app's current setup.

alter table app_settings
  add column if not exists unit_type text not null default 'branch'
  check (unit_type in ('ward', 'branch'));
