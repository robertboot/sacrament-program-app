-- Local/dev seed: one horse and one dog with their default schedules
-- and a couple of records. Replace <USER_ID> with your auth.users id
-- (visible in Supabase → Authentication → Users after signing in once).

with h as (
  insert into animals (user_id, name, species, breed, born)
  values ('<USER_ID>', 'Maple', 'horse', 'Quarter Horse', '2015')
  returning id
), d as (
  insert into animals (user_id, name, species, breed, born)
  values ('<USER_ID>', 'Blue', 'dog', 'Heeler', '2021')
  returning id
), hs as (
  insert into schedules (animal_id, treatment, interval_days)
  select h.id, t.treatment, t.interval_days
  from h, (values
    ('Coggins test', 365), ('Rabies', 365),
    ('Eastern/Western + Tetanus', 365), ('West Nile', 365),
    ('Flu/Rhino', 182), ('Strangles', 365),
    ('Hardware medicine', 56), ('Deworming', 56),
    ('Farrier/hoof trim', 42), ('Dental float', 365)
  ) as t(treatment, interval_days)
  returning id
), ds as (
  insert into schedules (animal_id, treatment, interval_days)
  select d.id, t.treatment, t.interval_days
  from d, (values
    ('Rabies', 365), ('DHPP', 365), ('Bordetella', 182),
    ('Leptospirosis', 365), ('Annual exam', 365),
    ('Hardware medicine', 30), ('Heartworm prevention', 30),
    ('Flea & tick', 30), ('Deworming', 90)
  ) as t(treatment, interval_days)
  returning id
)
insert into records (animal_id, treatment, given_on, next_due, product, given_by)
select h.id, 'Coggins test', date '2026-05-15', date '2027-05-15', 'AGID', 'Dr. Reyes' from h
union all
select h.id, 'Deworming', current_date - 70, current_date - 14, 'Ivermectin paste', 'Owner' from h
union all
select d.id, 'Heartworm prevention', current_date - 10, current_date + 20, 'Heartgard Plus', 'Owner' from d;
