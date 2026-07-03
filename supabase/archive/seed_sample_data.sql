-- Seed sample equipment and maintenance logs for Farm Kit.
-- Idempotent-ish: skips equipment rows that already exist by nickname,
-- and skips maintenance rows that already exist for the same equipment + title + maintenance_date.

begin;

-- Seed equipment
with equipment_seed as (
  select * from (
    values
      ('Unit 1 - Dewulf Kwatro','Harvester','Dewulf','Kwatro Xtreme',null,2019,'1','YA9S04B00K0298159',2019,null,null::date,null::date,null::date,null,null,null,true,''),
      ('Unit 2 - Dewulf Kwatro','Harvester','Dewulf','Kwatro',null,null,'2',null,null,null,null::date,null::date,null::date,null,null,null,true,''),
      ('9435 Massey Ferguson Swather','Swather','Massey Ferguson','9435',null,null,null,null,null,null,null::date,null::date,null::date,null,null,null,true,''),
      ('New Holland 9060','Harvester','New Holland','9060',null,null,null,null,null,null,null::date,null::date,null::date,null,null,null,true,''),
      ('Fendt 512','Tractor','Fendt','512',null,null,null,null,null,null,null::date,null::date,null::date,null,null,null,true,''),
      ('Artsway Beet Digger','Harvester','Artsway','Beet Digger',null,null,null,null,null,null,null::date,null::date,null::date,null,null,null,true,''),
      -- Extras to satisfy maintenance log references
      ('Straightcut Header','Header',null,null,null,null,null,null,null,null,null::date,null::date,null::date,null,null,null,true,''),
      ('Fendt 933','Tractor','Fendt','933',null,null,null,null,null,null,null::date,null::date,null::date,null,null,null,true,'')
  ) as v(
    nickname,
    category,
    make,
    model,
    serial_number,
    year,
    unit_number,
    vin_sn,
    year_of_purchase,
    license_class,
    next_service_at,
    cvip_expires_at,
    insurance_expires_at,
    oil_filter_number,
    fuel_filter_number,
    air_filter_number,
    active,
    notes
  )
)
insert into public.equipment (
  nickname,
  category,
  make,
  model,
  serial_number,
  year,
  unit_number,
  vin_sn,
  year_of_purchase,
  license_class,
  next_service_at,
  cvip_expires_at,
  insurance_expires_at,
  oil_filter_number,
  fuel_filter_number,
  air_filter_number,
  active,
  notes
)
select *
from equipment_seed s
where not exists (
  select 1 from public.equipment e where e.nickname = s.nickname
);

-- Seed maintenance logs
-- Ensure at least one user to satisfy created_by_id not-null in some environments
with seed_user as (
  insert into public.app_users (id, auth_user_id, name, first_name, last_name, email, role)
  values (gen_random_uuid(), gen_random_uuid(), 'Seed Bot', 'Seed', 'Bot', 'seed@example.com', 'admin')
  on conflict do nothing
  returning id
), fallback_user as (
  select id from seed_user
  union
  select id from public.app_users where email = 'seed@example.com'
  limit 1
), maintenance_seed as (
  select * from (
    values
      ('New Holland 9060','2023-02-14','2023-07-19T13:15:34','Worn parts and bearing repair','worn parts (remove, install, clean), holes in covers & worn lugs..., bearing failed (remove, clean, tighten, reinstall)','done'),
      ('Straightcut Header','2023-07-25','2023-07-29T17:21:24','Replace worn reel bushings','Replace worn reel bushings on the honeybee header','done'),
      ('9435 Massey Ferguson Swather','2023-06-15','2023-07-31T07:02:20','Install light bar and GPS, grease','Installed light bar. Installed GPS. Greased.','done'),
      ('Unit 2 - Dewulf Kwatro','2023-08-01','2023-08-01T10:16:47','New flails bearings','New Flales Bearings','done'),
      ('Unit 1 - Dewulf Kwatro','2023-08-01','2023-08-01T10:24:14','Rollers and hydraulic split','Rollers, new HYDRAULIC split.','done'),
      ('Unit 1 - Dewulf Kwatro','2023-08-01','2023-08-01T10:28:58','Checking','Checking','done'),
      ('Unit 2 - Dewulf Kwatro','2023-08-01','2023-08-01T10:35:03','Checking','Checking.','done'),
      ('Fendt 933','2023-08-02','2023-08-03T09:01:10','Tire swap','Tire swap','done'),
      ('Fendt 512','2023-08-09','2023-08-09T10:37:18','Cleaned air filter and radiators','Cleaned air filter & radiotors','done'),
      ('Artsway Beet Digger','2023-02-10','2023-08-10T15:15:41','Replaced digger wheel and bearings','Replaced digger wheel. Replaced bearings. Fixed axle. Greased.','done'),
      ('Artsway Beet Digger','2023-08-08','2023-08-10T15:17:17','Defoliator service','Artsway defoliator. Replaced flails. Checked bearings. Gearbox oil. Greased.','done'),
      ('Unit 1 - Dewulf Kwatro','2023-08-18','2023-08-19T17:44:57','Air filter cleaned','Air filter cleaned.','done')
  ) as v(
    equipment_nickname,
    maintenance_date,
    logged_at,
    title,
    description,
    status
  )
)
insert into public.maintenance_logs (
  equipment_id,
  created_by_id,
  title,
  description,
  status,
  maintenance_date,
  logged_at
)
select
  e.id,
  fu.id,
  s.title,
  s.description,
  s.status,
  s.maintenance_date::date,
  s.logged_at::timestamptz
from maintenance_seed s
join public.equipment e on e.nickname = s.equipment_nickname
cross join fallback_user fu
where not exists (
  select 1 from public.maintenance_logs m
  where m.equipment_id = e.id
    and m.title = s.title
    and m.maintenance_date = s.maintenance_date::date
);

commit;
