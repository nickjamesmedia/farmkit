-- Farmkit schema (data model v0.1)
-- Core modules: Equipment, Buildings (containers), Maintenance

create extension if not exists "pgcrypto";

-- roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('admin', 'manager', 'user')),
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

-- modules
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  default_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table if exists public.modules
  add column if not exists default_enabled boolean not null default true;

-- bootstrap/normalize v0.1 module keys (id-stable when renaming)
do $$
begin
  if exists (select 1 from public.modules where key = 'buildings')
    and not exists (select 1 from public.modules where key = 'containers_buildings')
  then
    update public.modules
      set key = 'containers_buildings'
      where key = 'buildings';
  end if;
end $$;

insert into public.modules (key, name, description, is_system, default_enabled)
values
  ('equipment', 'Equipment', 'Equipment tracking', true, true),
  ('maintenance', 'Maintenance', 'Maintenance logs and history', true, true),
  ('containers', 'Containers', 'Container/location hierarchy (buildings + storage)', true, true),
  ('containers_buildings', 'Buildings', 'Buildings (a containers submodule)', true, true),
  ('erp', 'ERP', 'Emergency response planning info (per location)', true, true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  default_enabled = excluded.default_enabled;

-- farms (primary + child farm locations)
create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_farm_id uuid references public.farms(id) on delete set null,
  timezone text not null default 'America/Edmonton',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by_auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists farms_parent_farm_id_idx on public.farms (parent_farm_id);

-- enforce two-level farm hierarchy (no child-of-child)
create or replace function public.farmkit_enforce_two_level_farms()
returns trigger
language plpgsql
as $$
begin
  if new.parent_farm_id is not null then
    if exists (
      select 1
      from public.farms parent
      where parent.id = new.parent_farm_id
        and parent.parent_farm_id is not null
    ) then
      raise exception 'Farmkit: two-level hierarchy only (cannot create a child farm under another child farm).';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'farms_two_level_enforce'
      and tgrelid = 'public.farms'::regclass
  ) then
    create trigger farms_two_level_enforce
    before insert or update of parent_farm_id on public.farms
    for each row execute function public.farmkit_enforce_two_level_farms();
  end if;
end $$;

-- farm_details (site/contact/branding)
create table if not exists public.farm_details (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  country text default 'Canada',
  latitude numeric,
  longitude numeric,
  primary_contact_name text,
  primary_contact_phone text,
  email text,
  phone text,
  website_url text,
  app_url text,
  favicon_url text,
  logo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null
);

-- farm_erp (emergency response planning, per farm/location)
create table if not exists public.farm_erp (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  nearest_town text,
  nearest_hospital_name text,
  nearest_hospital_distance_km numeric,
  emergency_instructions text,
  has_fuel_storage boolean default false,
  has_chemical_storage boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null
);

-- user_profiles (per auth user)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  default_farm_id uuid references public.farms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- farm_memberships (auth user -> farm)
create table if not exists public.farm_memberships (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  account_mode text not null default 'personal' check (account_mode in ('personal', 'shared')),
  person_id uuid,
  display_name_override text,
  -- Non-null only for system-generated "inherited" memberships (e.g., parent-farm Admin auto-enrolled to child farms).
  inherited_from_farm_id uuid references public.farms(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  last_seen_at timestamptz,
  unique (farm_id, auth_user_id)
);

alter table if exists public.farm_memberships
  add column if not exists person_id uuid;

alter table if exists public.farm_memberships
  add column if not exists inherited_from_farm_id uuid;

create index if not exists farm_memberships_farm_id_idx on public.farm_memberships (farm_id);
create index if not exists farm_memberships_auth_user_id_idx on public.farm_memberships (auth_user_id);
create index if not exists farm_memberships_person_id_idx on public.farm_memberships (person_id);
create index if not exists farm_memberships_inherited_from_farm_id_idx on public.farm_memberships (inherited_from_farm_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'farm_memberships_inherited_from_farm_id_fkey'
  ) then
    alter table public.farm_memberships
      add constraint farm_memberships_inherited_from_farm_id_fkey
      foreign key (inherited_from_farm_id) references public.farms(id) on delete set null;
  end if;
end $$;

-- Auto-enroll parent-farm Admins into all child farms (explicit membership rows)
--
-- Why: RLS already allows parent-farm Admins to access child-farm data, but we also want Admins to appear
-- as members of child farms in UI and membership lists. These rows are marked via `inherited_from_farm_id`
-- so they can be revoked cleanly if the parent Admin role is removed/demoted.

create or replace function public.farmkit_sync_admin_child_memberships_from_parent_membership()
returns trigger
language plpgsql
as $$
declare
  parent_is_top_level boolean;
  old_was_admin boolean;
  new_is_admin boolean;
begin
  select (f.parent_farm_id is null) into parent_is_top_level
  from public.farms f
  where f.id = coalesce(new.farm_id, old.farm_id);

  if not coalesce(parent_is_top_level, false) then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    select (r.key = 'admin') into old_was_admin
    from public.roles r
    where r.id = old.role_id;

    if old.status = 'active' and coalesce(old_was_admin, false) then
      if tg_op = 'DELETE' then
        delete from public.farm_memberships fm
        using public.farms child
        where child.parent_farm_id = old.farm_id
          and fm.farm_id = child.id
          and fm.auth_user_id = old.auth_user_id
          and fm.inherited_from_farm_id = old.farm_id;
      else
        select (r.key = 'admin') into new_is_admin
        from public.roles r
        where r.id = new.role_id;

        if new.status <> 'active' or not coalesce(new_is_admin, false) then
          delete from public.farm_memberships fm
          using public.farms child
          where child.parent_farm_id = old.farm_id
            and fm.farm_id = child.id
            and fm.auth_user_id = old.auth_user_id
            and fm.inherited_from_farm_id = old.farm_id;
        end if;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select (r.key = 'admin') into new_is_admin
    from public.roles r
    where r.id = new.role_id;

    if new.status = 'active' and coalesce(new_is_admin, false) then
      insert into public.farm_memberships (
        farm_id, auth_user_id, role_id, status, account_mode,
        person_id, display_name_override, created_by_auth_user_id,
        inherited_from_farm_id
      )
      select
        child.id,
        new.auth_user_id,
        new.role_id,
        'active',
        new.account_mode,
        null,
        new.display_name_override,
        new.created_by_auth_user_id,
        new.farm_id
      from public.farms child
      where child.parent_farm_id = new.farm_id
      on conflict (farm_id, auth_user_id) do nothing;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'farm_memberships_admin_child_enroll'
      and tgrelid = 'public.farm_memberships'::regclass
  ) then
    create trigger farm_memberships_admin_child_enroll
    after insert or update of role_id, status or delete on public.farm_memberships
    for each row execute function public.farmkit_sync_admin_child_memberships_from_parent_membership();
  end if;
end $$;

create or replace function public.farmkit_sync_admin_child_memberships_from_farm_change()
returns trigger
language plpgsql
as $$
begin
  -- If a farm is re-parented, clear inherited memberships from the previous parent.
  if tg_op = 'UPDATE' and old.parent_farm_id is distinct from new.parent_farm_id then
    if old.parent_farm_id is not null then
      delete from public.farm_memberships fm
      where fm.farm_id = new.id
        and fm.inherited_from_farm_id = old.parent_farm_id;
    end if;
  end if;

  -- When a child farm exists, ensure all active Admins on the parent farm are enrolled as inherited members.
  if new.parent_farm_id is not null then
    insert into public.farm_memberships (
      farm_id, auth_user_id, role_id, status, account_mode,
      person_id, display_name_override, created_by_auth_user_id,
      inherited_from_farm_id
    )
    select
      new.id,
      fm_parent.auth_user_id,
      fm_parent.role_id,
      'active',
      fm_parent.account_mode,
      null,
      fm_parent.display_name_override,
      new.created_by_auth_user_id,
      new.parent_farm_id
    from public.farm_memberships fm_parent
    join public.roles r on r.id = fm_parent.role_id
    where fm_parent.farm_id = new.parent_farm_id
      and fm_parent.status = 'active'
      and r.key = 'admin'
    on conflict (farm_id, auth_user_id) do nothing;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'farms_admin_child_enroll'
      and tgrelid = 'public.farms'::regclass
  ) then
    create trigger farms_admin_child_enroll
    after insert or update of parent_farm_id on public.farms
    for each row execute function public.farmkit_sync_admin_child_memberships_from_farm_change();
  end if;
end $$;

-- One-time (idempotent) helper to backfill and clean up inherited admin memberships.
create or replace function public.farmkit_ensure_admin_child_farm_memberships()
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Insert missing inherited memberships (active Admins on parent farms => all child farms).
  insert into public.farm_memberships (
    farm_id, auth_user_id, role_id, status, account_mode,
    person_id, display_name_override, created_by_auth_user_id,
    inherited_from_farm_id
  )
  select
    child.id,
    fm_parent.auth_user_id,
    fm_parent.role_id,
    'active',
    fm_parent.account_mode,
    null,
    fm_parent.display_name_override,
    fm_parent.created_by_auth_user_id,
    parent.id
  from public.farms parent
  join public.farms child on child.parent_farm_id = parent.id
  join public.farm_memberships fm_parent on fm_parent.farm_id = parent.id
  join public.roles r on r.id = fm_parent.role_id
  where parent.parent_farm_id is null
    and fm_parent.status = 'active'
    and r.key = 'admin'
  on conflict (farm_id, auth_user_id) do nothing;

  -- Delete stale inherited memberships (where the user is no longer an active Admin on the parent farm).
  delete from public.farm_memberships fm_child
  using public.farms child
  where fm_child.farm_id = child.id
    and child.parent_farm_id = fm_child.inherited_from_farm_id
    and fm_child.inherited_from_farm_id is not null
    and not exists (
      select 1
      from public.farm_memberships fm_parent
      join public.roles r on r.id = fm_parent.role_id
      where fm_parent.farm_id = fm_child.inherited_from_farm_id
        and fm_parent.auth_user_id = fm_child.auth_user_id
        and fm_parent.status = 'active'
        and r.key = 'admin'
    );
end;
$$;

revoke execute on function public.farmkit_ensure_admin_child_farm_memberships() from public;

select public.farmkit_ensure_admin_child_farm_memberships();

-- people (for shared-login attribution)
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  first_name text not null,
  last_name text,
  display_name text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists people_farm_id_idx on public.people (farm_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'farm_memberships_person_id_fkey'
  ) then
    alter table public.farm_memberships
      add constraint farm_memberships_person_id_fkey
      foreign key (person_id) references public.people(id) on delete set null;
  end if;
end $$;

-- farm_modules (farm -> module toggles)
create table if not exists public.farm_modules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  enabled boolean not null default true,
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_auth_user_id uuid references auth.users(id) on delete set null,
  unique (farm_id, module_id)
);

create index if not exists farm_modules_farm_id_idx on public.farm_modules (farm_id);

-- containers (buildings + nested storage)
create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  parent_id uuid references public.containers(id) on delete set null,
  container_kind text not null,
  name text not null,
  code text,
  description text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists containers_farm_id_idx on public.containers (farm_id);
create index if not exists containers_parent_id_idx on public.containers (parent_id);

-- building_details (1:1 for container_kind=building)
create table if not exists public.building_details (
  container_id uuid primary key references public.containers(id) on delete cascade,
  year_built int,
  heated boolean,
  has_water boolean,
  has_three_phase_power boolean,
  capacity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null
);

-- equipment
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  home_container_id uuid references public.containers(id) on delete set null,
  current_container_id uuid references public.containers(id) on delete set null,
  category text not null,
  make text,
  model text,
  nickname text,
  serial_number text,
  vin_sn text,
  unit_number text,
  year int,
  year_of_purchase int,
  license_class text,
  next_service_at date,
  cvip_expires_at date,
  insurance_expires_at date,
  oil_filter_number text,
  fuel_filter_number text,
  air_filter_number text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists equipment_farm_id_idx on public.equipment (farm_id);
create index if not exists equipment_home_container_id_idx on public.equipment (home_container_id);

-- maintenance_logs (equipment or container)
create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  container_id uuid references public.containers(id) on delete set null,
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  entered_by_person_id uuid references public.people(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'closed')),
  logged_at timestamptz not null default now(),
  maintenance_date date,
  hours_on_meter numeric,
  next_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null,
  check (equipment_id is not null or container_id is not null)
);

create index if not exists maintenance_logs_farm_id_idx on public.maintenance_logs (farm_id);
create index if not exists maintenance_logs_equipment_id_idx on public.maintenance_logs (equipment_id);
create index if not exists maintenance_logs_container_id_idx on public.maintenance_logs (container_id);
create index if not exists maintenance_logs_created_by_auth_user_id_idx on public.maintenance_logs (created_by_auth_user_id);
create index if not exists maintenance_logs_entered_by_person_id_idx on public.maintenance_logs (entered_by_person_id);

-- ---------------------------------------------------------------------------
-- v0.1 production additions (baseline migration only below this line)
-- ---------------------------------------------------------------------------

-- system roles
insert into public.roles (id, key, name, description, is_system)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'admin', 'Admin', 'Full access', true),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'manager', 'Manager', 'Operational management', true),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'user', 'User', 'Standard access', true)
on conflict (id) do nothing;

-- cross-farm reference integrity (RLS scopes by farm_id; these stop rows that
-- point at another farm's equipment/containers/people from being linked in)
create or replace function public.farmkit_validate_maintenance_log_refs()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.equipment_id is not null and not exists (
    select 1 from public.equipment e
    where e.id = new.equipment_id and e.farm_id = new.farm_id
  ) then
    raise exception 'Farmkit: equipment does not belong to this farm.';
  end if;
  if new.container_id is not null and not exists (
    select 1 from public.containers c
    where c.id = new.container_id and c.farm_id = new.farm_id
  ) then
    raise exception 'Farmkit: container does not belong to this farm.';
  end if;
  if new.entered_by_person_id is not null and not exists (
    select 1 from public.people p
    where p.id = new.entered_by_person_id and p.farm_id = new.farm_id
  ) then
    raise exception 'Farmkit: person does not belong to this farm.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'maintenance_logs_validate_refs'
      and tgrelid = 'public.maintenance_logs'::regclass
  ) then
    create trigger maintenance_logs_validate_refs
    before insert or update of equipment_id, container_id, entered_by_person_id, farm_id
    on public.maintenance_logs
    for each row execute function public.farmkit_validate_maintenance_log_refs();
  end if;
end $$;

create or replace function public.farmkit_validate_equipment_refs()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.home_container_id is not null and not exists (
    select 1 from public.containers c
    where c.id = new.home_container_id and c.farm_id = new.farm_id
  ) then
    raise exception 'Farmkit: home container does not belong to this farm.';
  end if;
  if new.current_container_id is not null and not exists (
    select 1 from public.containers c
    where c.id = new.current_container_id and c.farm_id = new.farm_id
  ) then
    raise exception 'Farmkit: current container does not belong to this farm.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'equipment_validate_refs'
      and tgrelid = 'public.equipment'::regclass
  ) then
    create trigger equipment_validate_refs
    before insert or update of home_container_id, current_container_id, farm_id
    on public.equipment
    for each row execute function public.farmkit_validate_equipment_refs();
  end if;
end $$;

create or replace function public.farmkit_validate_membership_person()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.person_id is not null and not exists (
    select 1 from public.people p
    where p.id = new.person_id and p.farm_id = new.farm_id
  ) then
    raise exception 'Farmkit: person does not belong to this farm.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'farm_memberships_validate_person'
      and tgrelid = 'public.farm_memberships'::regclass
  ) then
    create trigger farm_memberships_validate_person
    before insert or update of person_id, farm_id on public.farm_memberships
    for each row execute function public.farmkit_validate_membership_person();
  end if;
end $$;
