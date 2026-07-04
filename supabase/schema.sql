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

-- migrate: copy legacy ERP fields from farm_details -> farm_erp (if columns exist)
do $$
begin
  if
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'farm_details' and column_name = 'nearest_town'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'farm_details' and column_name = 'nearest_hospital_name'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'farm_details' and column_name = 'nearest_hospital_distance_km'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'farm_details' and column_name = 'emergency_instructions'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'farm_details' and column_name = 'has_fuel_storage'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'farm_details' and column_name = 'has_chemical_storage'
    )
  then
    insert into public.farm_erp (
      farm_id,
      nearest_town,
      nearest_hospital_name,
      nearest_hospital_distance_km,
      emergency_instructions,
      has_fuel_storage,
      has_chemical_storage
    )
    select
      fd.farm_id,
      fd.nearest_town,
      fd.nearest_hospital_name,
      fd.nearest_hospital_distance_km,
      fd.emergency_instructions,
      fd.has_fuel_storage,
      fd.has_chemical_storage
    from public.farm_details fd
    on conflict (farm_id) do update set
      nearest_town = coalesce(excluded.nearest_town, public.farm_erp.nearest_town),
      nearest_hospital_name = coalesce(excluded.nearest_hospital_name, public.farm_erp.nearest_hospital_name),
      nearest_hospital_distance_km = coalesce(excluded.nearest_hospital_distance_km, public.farm_erp.nearest_hospital_distance_km),
      emergency_instructions = coalesce(excluded.emergency_instructions, public.farm_erp.emergency_instructions),
      has_fuel_storage = coalesce(excluded.has_fuel_storage, public.farm_erp.has_fuel_storage),
      has_chemical_storage = coalesce(excluded.has_chemical_storage, public.farm_erp.has_chemical_storage);
  end if;
end $$;

-- migrate: remove ERP fields from farm_details (ERP is module-gated via farm_erp)
alter table if exists public.farm_details
  drop column if exists nearest_town,
  drop column if exists nearest_hospital_name,
  drop column if exists nearest_hospital_distance_km,
  drop column if exists emergency_instructions,
  drop column if exists has_fuel_storage,
  drop column if exists has_chemical_storage;

-- user_profiles (per auth user)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  default_farm_id uuid references public.farms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table if exists public.user_profiles
  add column if not exists email text;

-- farm_memberships (auth user -> farm)
create table if not exists public.farm_memberships (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  account_mode text not null default 'personal' check (account_mode in ('personal', 'shared')),
  person_id uuid,
  invited_email text,
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
  add column if not exists invited_email text;

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

-- farm_team_invites (invite audit + resend/rate-limit support)
create table if not exists public.farm_team_invites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  email text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  role_id uuid not null references public.roles(id) on delete restrict,
  account_mode text not null default 'personal' check (account_mode in ('personal', 'shared')),
  display_name text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'revoked', 'failed')),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  revoked_at timestamptz,
  accepted_at timestamptz,
  error_message text
);

create index if not exists farm_team_invites_farm_id_idx on public.farm_team_invites (farm_id);
create index if not exists farm_team_invites_email_idx on public.farm_team_invites (lower(email));
create index if not exists farm_team_invites_created_by_idx on public.farm_team_invites (created_by_auth_user_id, created_at);

create or replace function public.farmkit_team_members(target_farm_id uuid)
returns table (
  membership_id uuid,
  farm_id uuid,
  auth_user_id uuid,
  email text,
  display_name text,
  role_id uuid,
  role_key text,
  role_name text,
  status text,
  account_mode text,
  person_id uuid,
  display_name_override text,
  inherited_from_farm_id uuid,
  created_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    fm.id as membership_id,
    fm.farm_id,
    fm.auth_user_id,
    coalesce(up.email, au.email, fm.invited_email) as email,
    coalesce(
      nullif(fm.display_name_override, ''),
      nullif(up.display_name, ''),
      au.raw_user_meta_data ->> 'display_name',
      au.email,
      fm.invited_email
    ) as display_name,
    fm.role_id,
    r.key as role_key,
    r.name as role_name,
    fm.status,
    fm.account_mode,
    fm.person_id,
    fm.display_name_override,
    fm.inherited_from_farm_id,
    fm.created_at,
    fm.last_seen_at
  from public.farm_memberships fm
  join public.roles r on r.id = fm.role_id
  left join public.user_profiles up on up.auth_user_id = fm.auth_user_id
  left join auth.users au on au.id = fm.auth_user_id
  where fm.farm_id = target_farm_id
    and exists (
      select 1
      from public.farm_memberships fm_admin
      join public.roles r_admin on r_admin.id = fm_admin.role_id
      join public.farms f on f.id = target_farm_id
      where fm_admin.auth_user_id = auth.uid()
        and fm_admin.status = 'active'
        and r_admin.key = 'admin'
        and (fm_admin.farm_id = target_farm_id or fm_admin.farm_id = f.parent_farm_id)
    )
  order by
    coalesce(
      nullif(fm.display_name_override, ''),
      nullif(up.display_name, ''),
      au.email,
      fm.invited_email
    ) asc nulls last,
    fm.created_at asc;
$$;

create or replace function public.farmkit_auth_user_id_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select au.id
  from auth.users au
  where lower(au.email) = lower(target_email)
  limit 1;
$$;

create or replace function public.farmkit_accept_my_invites()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  update public.farm_memberships
  set
    status = 'active',
    last_seen_at = now()
  where auth_user_id = auth.uid()
    and status = 'invited';

  get diagnostics updated_count = row_count;

  update public.farm_team_invites
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, now())
  where auth_user_id = auth.uid()
    and status = 'sent';

  return updated_count;
end;
$$;

revoke execute on function public.farmkit_team_members(uuid) from public, anon;
grant execute on function public.farmkit_team_members(uuid) to authenticated;

revoke execute on function public.farmkit_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.farmkit_auth_user_id_by_email(text) to service_role;

revoke execute on function public.farmkit_accept_my_invites() from public, anon;
grant execute on function public.farmkit_accept_my_invites() to authenticated;

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
