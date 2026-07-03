-- Farmkit v0.1 demo seed data (auth users must exist first)
-- Create these users in Supabase Auth before running:
--   laura.admin@example.ca
--   devon.manager@example.ca
--   samir.user@example.ca
--   shop.shared@example.ca
--   harper.admin@example.ca

do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (
    values
      ('laura.admin@example.ca'),
      ('devon.manager@example.ca'),
      ('samir.user@example.ca'),
      ('shop.shared@example.ca'),
      ('harper.admin@example.ca')
  ) as expected(email)
  left join auth.users u on u.email = expected.email
  where u.id is null;

  if missing_count > 0 then
    raise exception 'Seed requires auth users to exist for all demo emails.';
  end if;
end $$;

create temporary table seed_auth_users as
select id, email
from auth.users
where email in (
  'laura.admin@example.ca',
  'devon.manager@example.ca',
  'samir.user@example.ca',
  'shop.shared@example.ca',
  'harper.admin@example.ca'
);

-- roles
insert into public.roles (id, key, name, description, is_system)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'admin', 'Admin', 'Full access', true),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'manager', 'Manager', 'Operational management', true),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'user', 'User', 'Standard access', true)
on conflict (id) do nothing;

-- modules
insert into public.modules (key, name, description, is_system, default_enabled)
values
  ('equipment', 'Equipment', 'Equipment tracking', true, true),
  ('containers', 'Containers', 'Containers and locations for equipment/items', true, true),
  ('containers_buildings', 'Buildings', 'Buildings under Containers', true, true),
  ('maintenance', 'Maintenance', 'Maintenance logging', true, true),
  ('erp', 'ERP', 'Emergency response planning', true, true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  default_enabled = excluded.default_enabled;

-- farms
insert into public.farms (id, name, slug, parent_farm_id, timezone, status, created_by_auth_user_id)
values
  ('30000000-0000-0000-0000-000000000001'::uuid, 'Prairie Valley Farms', 'prairie-valley', null,
    'America/Edmonton', 'active',
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000002'::uuid, 'Prairie Valley Farms - East Quarter', 'prairie-valley-east',
    '30000000-0000-0000-0000-000000000001'::uuid, 'America/Edmonton', 'active',
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'Prairie Valley Farms - North Yard', 'prairie-valley-north',
    '30000000-0000-0000-0000-000000000001'::uuid, 'America/Edmonton', 'active',
    (select id from seed_auth_users where email = 'laura.admin@example.ca'))
  ,('30000000-0000-0000-0000-000000000004'::uuid, 'Maple Ridge Farms', 'maple-ridge', null,
    'America/Winnipeg', 'active',
    (select id from seed_auth_users where email = 'harper.admin@example.ca'))
on conflict (id) do nothing;

-- farm_details
insert into public.farm_details (
  farm_id, address_line1, city, province, postal_code, country,
  primary_contact_name, primary_contact_phone,
  email, phone, website_url, notes
)
values
  ('30000000-0000-0000-0000-000000000001'::uuid, '101 Range Road 12', 'Leduc County', 'AB', 'T0C 1A0', 'Canada',
   'Laura McLeod', '780-555-0110',
   'hello@prairievalley.example.ca', '780-555-0100', 'https://prairievalley.example.ca',
   'Primary farm with two child locations.'),
  ('30000000-0000-0000-0000-000000000002'::uuid, 'SE 12-48-26 W4', 'Leduc County', 'AB', 'T0C 1A0', 'Canada',
   'Devon Chan', '780-555-0115',
   'east@prairievalley.example.ca', '780-555-0120', null,
   'East quarter fields and machine shed.'),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'NW 03-48-26 W4', 'Leduc County', 'AB', 'T0C 1A0', 'Canada',
   'Samir Singh', '780-555-0125',
   'north@prairievalley.example.ca', '780-555-0130', null,
   'North yard and grain handling area.')
  ,('30000000-0000-0000-0000-000000000004'::uuid, '45 Township Rd 120', 'Morden', 'MB', 'R6M 1A1', 'Canada',
   'Harper Ellis', '204-555-0188',
   'info@mapleridge.example.ca', '204-555-0105', 'https://mapleridge.example.ca',
   'Secondary client farm for RLS testing.')
on conflict (farm_id) do nothing;

-- farm_erp
insert into public.farm_erp (
  farm_id, nearest_town, nearest_hospital_name, nearest_hospital_distance_km,
  emergency_instructions, has_fuel_storage, has_chemical_storage
)
values
  ('30000000-0000-0000-0000-000000000001'::uuid, 'Millet', 'Leduc Community Hospital', 18,
    'Emergency kit in shop office, west wall.', true, true),
  ('30000000-0000-0000-0000-000000000002'::uuid, 'Millet', 'Leduc Community Hospital', 22,
    'First aid in the pickup, fire extinguisher by bay door.', false, true),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'Warburg', 'Leduc Community Hospital', 34,
    'Emergency shutoff marked in north yard panel.', true, false),
  ('30000000-0000-0000-0000-000000000004'::uuid, 'Morden', 'Boundary Trails Health Centre', 9,
    'Emergency binder is in the office cabinet.', false, true)
on conflict (farm_id) do nothing;

-- user_profiles
insert into public.user_profiles (auth_user_id, display_name, default_farm_id)
select id, 'Laura McLeod', '30000000-0000-0000-0000-000000000001'::uuid
from seed_auth_users where email = 'laura.admin@example.ca'
union all
select id, 'Devon Chan', '30000000-0000-0000-0000-000000000002'::uuid
from seed_auth_users where email = 'devon.manager@example.ca'
union all
select id, 'Samir Singh', '30000000-0000-0000-0000-000000000003'::uuid
from seed_auth_users where email = 'samir.user@example.ca'
union all
select id, 'Shop Tablet', '30000000-0000-0000-0000-000000000001'::uuid
from seed_auth_users where email = 'shop.shared@example.ca'
union all
select id, 'Harper Ellis', '30000000-0000-0000-0000-000000000004'::uuid
from seed_auth_users where email = 'harper.admin@example.ca'
on conflict (auth_user_id) do nothing;

-- people (shared-login attribution)
insert into public.people (id, farm_id, first_name, last_name, display_name, active, notes)
values
  ('60000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, 'Avery', 'Kowalski', null, true, 'Seasonal operator.'),
  ('60000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, 'Noah', 'Bouchard', null, true, 'Shop lead.'),
  ('60000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, 'Priya', 'Gill', null, true, 'East quarter operations.'),
  ('60000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'Megan', 'Fraser', null, true, 'North yard grain handling.'),
  ('60000000-0000-0000-0000-000000000005'::uuid, '30000000-0000-0000-0000-000000000004'::uuid, 'Liam', 'Porter', null, true, 'Maple Ridge field ops.'),
  ('60000000-0000-0000-0000-000000000006'::uuid, '30000000-0000-0000-0000-000000000004'::uuid, 'Chloe', 'Bernard', null, true, 'Maple Ridge shop support.'),
  ('60000000-0000-0000-0000-000000000007'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, 'Laura', 'McLeod', null, true, 'User account.'),
  ('60000000-0000-0000-0000-000000000008'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, 'Devon', 'Chan', null, true, 'User account.'),
  ('60000000-0000-0000-0000-000000000009'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'Samir', 'Singh', null, true, 'User account.'),
  ('60000000-0000-0000-0000-000000000010'::uuid, '30000000-0000-0000-0000-000000000004'::uuid, 'Harper', 'Ellis', null, true, 'User account.')
on conflict (id) do nothing;

-- farm_memberships
insert into public.farm_memberships (
  farm_id, auth_user_id, role_id, status, account_mode, person_id, display_name_override, created_by_auth_user_id
)
select
  '30000000-0000-0000-0000-000000000001'::uuid,
  (select id from seed_auth_users where email = 'laura.admin@example.ca'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'active',
  'personal',
  '60000000-0000-0000-0000-000000000007'::uuid,
  null,
  (select id from seed_auth_users where email = 'laura.admin@example.ca')
union all
select
  '30000000-0000-0000-0000-000000000002'::uuid,
  (select id from seed_auth_users where email = 'devon.manager@example.ca'),
  '10000000-0000-0000-0000-000000000002'::uuid,
  'active',
  'personal',
  '60000000-0000-0000-0000-000000000008'::uuid,
  null,
  (select id from seed_auth_users where email = 'laura.admin@example.ca')
union all
select
  '30000000-0000-0000-0000-000000000003'::uuid,
  (select id from seed_auth_users where email = 'samir.user@example.ca'),
  '10000000-0000-0000-0000-000000000003'::uuid,
  'active',
  'personal',
  '60000000-0000-0000-0000-000000000009'::uuid,
  null,
  (select id from seed_auth_users where email = 'laura.admin@example.ca')
union all
select
  '30000000-0000-0000-0000-000000000001'::uuid,
  (select id from seed_auth_users where email = 'shop.shared@example.ca'),
  '10000000-0000-0000-0000-000000000003'::uuid,
  'active',
  'shared',
  null,
  'Shop Tablet',
  (select id from seed_auth_users where email = 'laura.admin@example.ca')
union all
select
  '30000000-0000-0000-0000-000000000004'::uuid,
  (select id from seed_auth_users where email = 'harper.admin@example.ca'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'active',
  'personal',
  '60000000-0000-0000-0000-000000000010'::uuid,
  null,
  (select id from seed_auth_users where email = 'harper.admin@example.ca')
on conflict (farm_id, auth_user_id) do nothing;


-- farm_modules
insert into public.farm_modules (farm_id, module_id, enabled, enabled_at, updated_by_auth_user_id)
values
  -- Prairie Valley (parent farm config)
  ('30000000-0000-0000-0000-000000000001'::uuid, (select id from public.modules where key = 'equipment'), true, now(),
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000001'::uuid, (select id from public.modules where key = 'containers'), true, now(),
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000001'::uuid, (select id from public.modules where key = 'containers_buildings'), true, now(),
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000001'::uuid, (select id from public.modules where key = 'maintenance'), true, now(),
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000001'::uuid, (select id from public.modules where key = 'erp'), true, now(),
    (select id from seed_auth_users where email = 'laura.admin@example.ca')),

  -- Maple Ridge (parent farm config)
  ('30000000-0000-0000-0000-000000000004'::uuid, (select id from public.modules where key = 'equipment'), true, now(),
    (select id from seed_auth_users where email = 'harper.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000004'::uuid, (select id from public.modules where key = 'containers'), true, now(),
    (select id from seed_auth_users where email = 'harper.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000004'::uuid, (select id from public.modules where key = 'containers_buildings'), true, now(),
    (select id from seed_auth_users where email = 'harper.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000004'::uuid, (select id from public.modules where key = 'maintenance'), true, now(),
    (select id from seed_auth_users where email = 'harper.admin@example.ca')),
  ('30000000-0000-0000-0000-000000000004'::uuid, (select id from public.modules where key = 'erp'), true, now(),
    (select id from seed_auth_users where email = 'harper.admin@example.ca'))
on conflict (farm_id, module_id) do nothing;

-- containers (buildings + storage)
insert into public.containers (id, farm_id, parent_id, container_kind, name, code, description, notes, created_by_auth_user_id)
values
  ('40000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, null, 'building',
   'Main Shop', 'SHOP-01', 'Primary repair shop', 'Heated, three bays.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('40000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, null, 'building',
   'Machine Shed', 'MS-02', 'Covered storage for field equipment', null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('40000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, null, 'building',
   'Grain Handling', 'BIN-03', 'Grain bin and intake area', null,
   (select id from seed_auth_users where email = 'samir.user@example.ca')),
  ('40000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, 'room',
   'Parts Room', 'ROOM-01', 'Consumables and common parts', null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('40000000-0000-0000-0000-000000000005'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000004'::uuid, 'shelf',
   'Filters Shelf', 'SHELF-A', 'Oil, fuel, and air filters', null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('40000000-0000-0000-0000-000000000006'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, null, 'yard',
   'North Yard Pad', 'YARD-01', 'Outdoor equipment staging', null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'))
  ,('40000000-0000-0000-0000-000000000007'::uuid, '30000000-0000-0000-0000-000000000004'::uuid, null, 'building',
   'Maple Ridge Shop', 'SHOP-MR', 'Primary shop and storage', 'Two bays, heated.',
   (select id from seed_auth_users where email = 'harper.admin@example.ca'))
  ,('40000000-0000-0000-0000-000000000008'::uuid, '30000000-0000-0000-0000-000000000004'::uuid, null, 'yard',
   'Maple Ridge Yard', 'YARD-MR', 'Outdoor staging area', null,
   (select id from seed_auth_users where email = 'harper.admin@example.ca'))
on conflict (id) do nothing;

-- building_details
insert into public.building_details (container_id, year_built, heated, has_water, has_three_phase_power, capacity)
values
  ('40000000-0000-0000-0000-000000000001'::uuid, 1998, true, true, true, '3 bays'),
  ('40000000-0000-0000-0000-000000000002'::uuid, 2006, false, false, false, '12 equipment slots'),
  ('40000000-0000-0000-0000-000000000003'::uuid, 2012, false, false, true, '4 bins'),
  ('40000000-0000-0000-0000-000000000007'::uuid, 2004, true, true, false, '2 bays')
on conflict (container_id) do nothing;

-- equipment
insert into public.equipment (
  id, farm_id, home_container_id, current_container_id, category, make, model, nickname,
  serial_number, vin_sn, unit_number, year, year_of_purchase, license_class,
  next_service_at, cvip_expires_at, insurance_expires_at,
  oil_filter_number, fuel_filter_number, air_filter_number,
  active, notes, created_by_auth_user_id
)
values
  ('50000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'tractor', 'John Deere', '8R 310', 'Green Thunder',
   'JD8R310-2020', null, 'TR-08', 2020, 2021, 'Class 1',
   '2026-03-15', '2026-12-31', '2026-06-30',
   'JD-OF-455', 'JD-FF-210', 'JD-AF-990',
   true, 'Main row crop tractor.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, '40000000-0000-0000-0000-000000000002'::uuid,
   'combine', 'Case IH', '8250', 'Red Harvester',
   'CIH-8250-2018', null, 'CB-12', 2018, 2019, 'Class 3',
   '2026-02-01', '2026-11-30', '2026-05-31',
   'CIH-OF-883', 'CIH-FF-412', 'CIH-AF-301',
   true, 'East quarter combine.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, null,
   'baler', 'New Holland', 'Roll-Belt 560', 'Blue Twine',
   'NH-RB-2017', null, 'BL-07', 2017, 2018, null,
   '2026-04-10', null, null,
   null, null, null,
   true, 'Stored in main shop.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '40000000-0000-0000-0000-000000000006'::uuid, '40000000-0000-0000-0000-000000000006'::uuid,
   'auger', 'Westfield', 'MKX 100-63', 'North Auger',
   'WF-MKX-2021', null, 'AG-03', 2021, 2022, null,
   '2026-01-20', null, null,
   null, null, null,
   true, 'Grain handling auger for north yard.',
   (select id from seed_auth_users where email = 'samir.user@example.ca')),
  ('50000000-0000-0000-0000-000000000005'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'tractor', 'Fendt', '724 Vario', 'Field Runner',
   'FD724-2019', null, 'TR-12', 2019, 2020, 'Class 1',
   '2026-04-01', '2026-11-30', '2026-07-15',
   'FD-OF-724', 'FD-FF-724', 'FD-AF-724',
   true, 'Row crop tractor for primary farm.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000006'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, null,
   'tractor', 'Fendt', '1050 G3', 'Big Timber',
   'FD1050-2021', null, 'TR-16', 2021, 2022, 'Class 1',
   '2026-05-10', '2027-01-31', '2026-09-30',
   'FD-OF-1050', 'FD-FF-1050', 'FD-AF-1050',
   true, 'High-horsepower tractor for tillage.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000007'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, '40000000-0000-0000-0000-000000000002'::uuid,
   'harvester', 'Dewulf', 'Kwatro', 'Red Harvester',
   'DW-KW-2020', null, 'HV-07', 2020, 2021, null,
   '2026-03-20', null, '2026-08-31',
   null, null, null,
   true, 'Potato harvester for east quarter.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000008'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '40000000-0000-0000-0000-000000000006'::uuid, '40000000-0000-0000-0000-000000000003'::uuid,
   'harvester', 'Dewulf', 'Enduro', 'Enduro',
   'DW-END-2018', null, 'HV-11', 2018, 2019, null,
   '2026-02-15', null, '2026-10-31',
   null, null, null,
   true, 'Storage yard harvester.',
   (select id from seed_auth_users where email = 'samir.user@example.ca')),
  ('50000000-0000-0000-0000-000000000009'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'telehandler', 'JCB', '531-70', 'Loader',
   'JCB-53170-2017', null, 'TL-03', 2017, 2018, null,
   '2026-02-28', null, null,
   null, null, null,
   true, 'Telehandler for shop and yard.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000010'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, '40000000-0000-0000-0000-000000000002'::uuid,
   'forklift', 'Hyster', 'H50FT', 'Yard Lift',
   'HY-H50FT-2016', null, 'FL-05', 2016, 2017, null,
   '2026-03-01', null, null,
   null, null, null,
   true, 'Diesel forklift for pallets.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000011'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'forklift', 'Toyota', '8FGU25', 'Shop Lift',
   'TY-8FGU25-2018', null, 'FL-02', 2018, 2019, null,
   '2026-02-12', null, null,
   null, null, null,
   true, 'Warehouse forklift.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000012'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, null,
   'planter', 'AGCO', 'Corn & Beet Planter', 'Row Planter',
   'AG-PLAN-2015', null, 'PL-09', 2015, 2016, null,
   '2026-04-05', null, null,
   null, null, null,
   true, 'Planter for corn and beet rows.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000013'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, '40000000-0000-0000-0000-000000000002'::uuid,
   'seeder', 'New Holland', 'P2080 Air Seeder', 'Seeder',
   'NH-P2080-2019', null, 'SD-04', 2019, 2020, null,
   '2026-03-25', null, null,
   null, null, null,
   true, 'Air seeder for spring planting.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000014'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, null,
   'hiller', 'Baselier', 'Powerhiller', 'Hiller',
   'BS-PH-2014', null, 'HL-01', 2014, 2015, null,
   '2026-04-15', null, null,
   null, null, null,
   true, 'Potato hilling implement.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000015'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '40000000-0000-0000-0000-000000000002'::uuid, null,
   'tillage', 'Bednar', 'Terraland', 'Deep Ripper',
   'BD-TRL-2013', null, 'TL-08', 2013, 2014, null,
   '2026-04-18', null, null,
   null, null, null,
   true, 'Deep tillage unit.',
   (select id from seed_auth_users where email = 'devon.manager@example.ca')),
  ('50000000-0000-0000-0000-000000000016'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '40000000-0000-0000-0000-000000000003'::uuid, '40000000-0000-0000-0000-000000000003'::uuid,
   'hopper', 'Miedema', 'Receiving Hopper', 'Intake Hopper',
   'MD-HOP-2021', null, 'HP-02', 2021, 2021, null,
   '2026-02-05', null, null,
   null, null, null,
   true, 'Potato receiving hopper.',
   (select id from seed_auth_users where email = 'samir.user@example.ca')),
  ('50000000-0000-0000-0000-000000000017'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '40000000-0000-0000-0000-000000000003'::uuid, '40000000-0000-0000-0000-000000000003'::uuid,
   'piler', 'Spudnik', 'Piler', 'Pile King',
   'SP-PIL-2017', null, 'PL-17', 2017, 2018, null,
   '2026-02-12', null, null,
   null, null, null,
   true, 'Storage piler for potato shed.',
   (select id from seed_auth_users where email = 'samir.user@example.ca')),
  ('50000000-0000-0000-0000-000000000018'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '40000000-0000-0000-0000-000000000003'::uuid, '40000000-0000-0000-0000-000000000003'::uuid,
   'conveyor', 'Bau-Man', '30-inch Conveyor', 'Line Conveyor',
   'BM-CNV-2016', null, 'CV-06', 2016, 2017, null,
   '2026-02-20', null, null,
   null, null, null,
   true, 'Mainline conveyor.',
   (select id from seed_auth_users where email = 'samir.user@example.ca')),
  ('50000000-0000-0000-0000-000000000019'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, null,
   'trailer', 'Jako', '220', 'Multi Trailer',
   'JK-220-2015', null, 'TR-22', 2015, 2016, 'Class 3',
   '2026-03-05', '2026-10-31', '2026-08-31',
   null, null, null,
   true, 'Multi-purpose trailer.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000020'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '40000000-0000-0000-0000-000000000001'::uuid, null,
   'truck', 'Chevrolet', 'Silverado 2500HD', 'Service Truck',
   'CH-2500-2018', null, 'SV-01', 2018, 2018, 'Class 3',
   '2026-02-25', null, '2026-07-31',
   null, null, null,
   true, 'Service truck for farm calls.',
   (select id from seed_auth_users where email = 'laura.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000021'::uuid, '30000000-0000-0000-0000-000000000004'::uuid,
   '40000000-0000-0000-0000-000000000007'::uuid, '40000000-0000-0000-0000-000000000007'::uuid,
   'sprayer', 'Case IH', 'Patriot', 'Spray Hawk',
   'CIH-SPR-2016', null, 'SP-01', 2016, 2016, 'Class 3',
   '2026-03-12', null, '2026-08-15',
   null, null, null,
   true, 'Self-propelled sprayer for Maple Ridge.',
   (select id from seed_auth_users where email = 'harper.admin@example.ca')),
  ('50000000-0000-0000-0000-000000000022'::uuid, '30000000-0000-0000-0000-000000000004'::uuid,
   '40000000-0000-0000-0000-000000000008'::uuid, '40000000-0000-0000-0000-000000000008'::uuid,
   'excavator', 'Caterpillar', '320D', 'Digger',
   'CAT-320D-2014', null, 'EX-01', 2014, 2015, null,
   '2026-02-22', null, null,
   null, null, null,
   true, 'Excavator for drainage and yard work.',
   (select id from seed_auth_users where email = 'harper.admin@example.ca'))
on conflict (id) do nothing;

-- maintenance_logs
insert into public.maintenance_logs (
  id, farm_id, equipment_id, container_id, created_by_auth_user_id, entered_by_person_id,
  title, description, status, logged_at, maintenance_date, hours_on_meter, next_due_at
)
values
  ('70000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000001'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Oil change + inspection', 'Changed oil and filters, checked belts.', 'closed',
   now() - interval '10 days', '2026-01-05', 1240.5, '2026-07-05'),
  ('70000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000002'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Header inspection', 'Replaced worn guards and adjusted tension.', 'open',
   now() - interval '3 days', '2026-01-12', 890.2, '2026-02-01'),
  ('70000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   null, '40000000-0000-0000-0000-000000000001'::uuid,
   (select id from seed_auth_users where email = 'shop.shared@example.ca'),
   '60000000-0000-0000-0000-000000000002'::uuid,
   'Shop heater service', 'Cleaned filters and tested thermostat.', 'closed',
   now() - interval '20 days', '2025-12-22', null, null),
  ('70000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000004'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Auger gearbox check', 'Inspected gearbox, topped off oil.', 'closed',
   now() - interval '7 days', '2026-01-08', 12.0, '2026-06-15'),
  ('70000000-0000-0000-0000-000000000005'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000001'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Hydraulic filter swap', 'Replaced hydraulic filter and topped off fluid.', 'closed',
   '2026-01-18', '2026-01-18', 1265.0, '2026-08-01'),
  ('70000000-0000-0000-0000-000000000006'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000002'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Chopper belt replacement', 'Replaced worn chopper belt and checked tension.', 'closed',
   '2026-01-16', '2026-01-16', 915.0, '2026-03-15'),
  ('70000000-0000-0000-0000-000000000007'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000003'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Pickup tine replacement', 'Swapped damaged pickup tines.', 'closed',
   '2026-01-10', '2026-01-10', null, null),
  ('70000000-0000-0000-0000-000000000008'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000003'::uuid, null,
   (select id from seed_auth_users where email = 'shop.shared@example.ca'),
   '60000000-0000-0000-0000-000000000002'::uuid,
   'Chain tension + grease', 'Adjusted chains and greased fittings.', 'open',
   '2026-01-22', '2026-01-22', null, null),
  ('70000000-0000-0000-0000-000000000009'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000004'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Flighting inspection', 'Checked flighting and gearbox for wear.', 'closed',
   '2026-01-14', '2026-01-14', 14.0, '2026-07-01'),
  ('70000000-0000-0000-0000-000000000010'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000005'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Seasonal service', 'Oil change and full inspection.', 'closed',
   '2026-01-09', '2026-01-09', 980.0, '2026-07-09'),
  ('70000000-0000-0000-0000-000000000011'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000005'::uuid, null,
   (select id from seed_auth_users where email = 'shop.shared@example.ca'),
   '60000000-0000-0000-0000-000000000002'::uuid,
   'Cabin filter replace', 'Replaced cab air filter.', 'closed',
   '2026-01-23', '2026-01-23', 995.0, null),
  ('70000000-0000-0000-0000-000000000012'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000006'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Transmission check', 'Checked transmission fluid and sensors.', 'closed',
   '2026-01-12', '2026-01-12', 620.0, '2026-07-12'),
  ('70000000-0000-0000-0000-000000000013'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000006'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Tire inspection', 'Inspected tires and set pressures.', 'closed',
   '2026-01-26', '2026-01-26', 640.0, null),
  ('70000000-0000-0000-0000-000000000014'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000007'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Hydraulic hose replacement', 'Replaced cracked hydraulic hose.', 'closed',
   '2026-01-11', '2026-01-11', 520.0, '2026-06-01'),
  ('70000000-0000-0000-0000-000000000015'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000007'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Elevator chain tension', 'Adjusted elevator chain and lubricated.', 'open',
   '2026-01-27', '2026-01-27', 530.0, null),
  ('70000000-0000-0000-0000-000000000016'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000008'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Roller inspection', 'Checked roller bearings and belts.', 'closed',
   '2026-01-13', '2026-01-13', 430.0, null),
  ('70000000-0000-0000-0000-000000000017'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000008'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Hydraulic oil top-up', 'Topped up hydraulic oil and checked leaks.', 'closed',
   '2026-01-24', '2026-01-24', 445.0, null),
  ('70000000-0000-0000-0000-000000000018'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000009'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Boom inspection', 'Inspected boom wear pads and pins.', 'closed',
   '2026-01-08', '2026-01-08', 2100.0, null),
  ('70000000-0000-0000-0000-000000000019'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000009'::uuid, null,
   (select id from seed_auth_users where email = 'shop.shared@example.ca'),
   '60000000-0000-0000-0000-000000000002'::uuid,
   'Grease fittings', 'Greased all fittings and checked lights.', 'closed',
   '2026-01-21', '2026-01-21', 2120.0, null),
  ('70000000-0000-0000-0000-000000000020'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000010'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Brake service', 'Adjusted brakes and replaced pads.', 'closed',
   '2026-01-15', '2026-01-15', 3400.0, null),
  ('70000000-0000-0000-0000-000000000021'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000010'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Hydraulic leak check', 'Inspected mast cylinders for leaks.', 'open',
   '2026-01-28', '2026-01-28', 3420.0, null),
  ('70000000-0000-0000-0000-000000000022'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000011'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Battery check', 'Checked battery and cleaned terminals.', 'closed',
   '2026-01-06', '2026-01-06', 1500.0, null),
  ('70000000-0000-0000-0000-000000000023'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000011'::uuid, null,
   (select id from seed_auth_users where email = 'shop.shared@example.ca'),
   '60000000-0000-0000-0000-000000000001'::uuid,
   'Mast chain lube', 'Lubed mast chains and checked rollers.', 'closed',
   '2026-01-20', '2026-01-20', 1525.0, null),
  ('70000000-0000-0000-0000-000000000024'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000012'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Row unit cleanup', 'Cleaned row units and checked meters.', 'closed',
   '2026-01-17', '2026-01-17', null, null),
  ('70000000-0000-0000-0000-000000000025'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000012'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Depth gauge service', 'Replaced worn depth gauge wheels.', 'closed',
   '2026-01-29', '2026-01-29', null, null),
  ('70000000-0000-0000-0000-000000000026'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000013'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Fan belt replace', 'Installed new fan belt and checked tension.', 'closed',
   '2026-01-19', '2026-01-19', null, null),
  ('70000000-0000-0000-0000-000000000027'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000013'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Seed hose inspection', 'Inspected seed hoses for cracks.', 'open',
   '2026-01-30', '2026-01-30', null, null),
  ('70000000-0000-0000-0000-000000000028'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000014'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Drive chain adjustment', 'Adjusted drive chains and greased bearings.', 'closed',
   '2026-01-07', '2026-01-07', null, null),
  ('70000000-0000-0000-0000-000000000029'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000014'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Blade wear check', 'Checked blades for wear; order replacements.', 'open',
   '2026-01-25', '2026-01-25', null, null),
  ('70000000-0000-0000-0000-000000000030'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000015'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Shank inspection', 'Inspected shanks and replaced two points.', 'closed',
   '2026-01-11', '2026-01-11', null, null),
  ('70000000-0000-0000-0000-000000000031'::uuid, '30000000-0000-0000-0000-000000000002'::uuid,
   '50000000-0000-0000-0000-000000000015'::uuid, null,
   (select id from seed_auth_users where email = 'devon.manager@example.ca'),
   '60000000-0000-0000-0000-000000000008'::uuid,
   'Hydraulic cylinder check', 'Checked cylinders for seepage.', 'closed',
   '2026-01-22', '2026-01-22', null, null),
  ('70000000-0000-0000-0000-000000000032'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000016'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Belt alignment', 'Aligned belt and checked rollers.', 'closed',
   '2026-01-09', '2026-01-09', null, null),
  ('70000000-0000-0000-0000-000000000033'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000016'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Guard inspection', 'Inspected safety guards and fasteners.', 'closed',
   '2026-01-23', '2026-01-23', null, null),
  ('70000000-0000-0000-0000-000000000034'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000017'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Motor service', 'Checked motor mounts and wiring.', 'closed',
   '2026-01-10', '2026-01-10', null, null),
  ('70000000-0000-0000-0000-000000000035'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000017'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Tire and roller check', 'Inspected roller tires for wear.', 'open',
   '2026-01-27', '2026-01-27', null, null),
  ('70000000-0000-0000-0000-000000000036'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000018'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Belt tracking', 'Adjusted belt tracking and cleaned rollers.', 'closed',
   '2026-01-12', '2026-01-12', null, null),
  ('70000000-0000-0000-0000-000000000037'::uuid, '30000000-0000-0000-0000-000000000003'::uuid,
   '50000000-0000-0000-0000-000000000018'::uuid, null,
   (select id from seed_auth_users where email = 'samir.user@example.ca'),
   '60000000-0000-0000-0000-000000000009'::uuid,
   'Drive chain lube', 'Lubed drive chain and sprockets.', 'closed',
   '2026-01-26', '2026-01-26', null, null),
  ('70000000-0000-0000-0000-000000000038'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000019'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Brake inspection', 'Checked electric brakes and wiring.', 'closed',
   '2026-01-14', '2026-01-14', null, null),
  ('70000000-0000-0000-0000-000000000039'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000019'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Tire rotation', 'Rotated tires and checked pressures.', 'closed',
   '2026-01-24', '2026-01-24', null, null),
  ('70000000-0000-0000-0000-000000000040'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000020'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Oil change', 'Changed oil and filter.', 'closed',
   '2026-01-05', '2026-01-05', null, null),
  ('70000000-0000-0000-0000-000000000041'::uuid, '30000000-0000-0000-0000-000000000001'::uuid,
   '50000000-0000-0000-0000-000000000020'::uuid, null,
   (select id from seed_auth_users where email = 'laura.admin@example.ca'),
   '60000000-0000-0000-0000-000000000007'::uuid,
   'Brake service', 'Replaced front brake pads.', 'closed',
   '2026-01-18', '2026-01-18', null, null),
  ('70000000-0000-0000-0000-000000000042'::uuid, '30000000-0000-0000-0000-000000000004'::uuid,
   '50000000-0000-0000-0000-000000000021'::uuid, null,
   (select id from seed_auth_users where email = 'harper.admin@example.ca'),
   '60000000-0000-0000-0000-000000000010'::uuid,
   'Nozzle inspection', 'Inspected nozzles and replaced two tips.', 'closed',
   '2026-01-19', '2026-01-19', 780.0, '2026-06-01'),
  ('70000000-0000-0000-0000-000000000043'::uuid, '30000000-0000-0000-0000-000000000004'::uuid,
   '50000000-0000-0000-0000-000000000021'::uuid, null,
   (select id from seed_auth_users where email = 'harper.admin@example.ca'),
   '60000000-0000-0000-0000-000000000010'::uuid,
   'Pump service', 'Checked pump seals and pressure output.', 'open',
   '2026-01-28', '2026-01-28', 792.0, null),
  ('70000000-0000-0000-0000-000000000044'::uuid, '30000000-0000-0000-0000-000000000004'::uuid,
   '50000000-0000-0000-0000-000000000022'::uuid, null,
   (select id from seed_auth_users where email = 'harper.admin@example.ca'),
   '60000000-0000-0000-0000-000000000010'::uuid,
   'Hydraulic filter change', 'Replaced hydraulic filter and checked hoses.', 'closed',
   '2026-01-15', '2026-01-15', 1640.0, '2026-07-15'),
  ('70000000-0000-0000-0000-000000000045'::uuid, '30000000-0000-0000-0000-000000000004'::uuid,
   '50000000-0000-0000-0000-000000000022'::uuid, null,
   (select id from seed_auth_users where email = 'harper.admin@example.ca'),
   '60000000-0000-0000-0000-000000000010'::uuid,
   'Track tension check', 'Checked track tension and undercarriage wear.', 'open',
   '2026-01-29', '2026-01-29', 1655.0, null)
on conflict (id) do nothing;

drop table if exists seed_auth_users;
