-- Farmkit v0.1 RLS policies (production)
-- Hardened from rls_policies_dev.sql for the v0.1 beta:
--   * helper functions pin search_path to public, pg_temp and are only
--     executable by authenticated
--   * all policies bind to the authenticated role
--   * containers_update no longer relies on a self-referencing scalar
--     subquery (it errored at runtime for manager updates)
--   * maintenance_logs inserts must be authored by auth.uid(); shared-account
--     members must attribute a person

begin;

-- Helper functions
create or replace function public.farmkit_can_access_farm_data(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_memberships fm
    join public.farms f on f.id = target_farm_id
    where fm.auth_user_id = auth.uid()
      and fm.status = 'active'
      and (fm.farm_id = target_farm_id or fm.farm_id = f.parent_farm_id)
  );
$$;

create or replace function public.farmkit_can_read_farm_metadata(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_memberships fm
    where fm.auth_user_id = auth.uid()
      and fm.status = 'active'
      and (
        fm.farm_id = target_farm_id
        or fm.farm_id = (
          select f.parent_farm_id
          from public.farms f
          where f.id = target_farm_id
        )
        or fm.farm_id in (
          select child.id
          from public.farms child
          where child.parent_farm_id = target_farm_id
        )
      )
  );
$$;

-- Backwards-compatible helper (keep while refactoring)
create or replace function public.farmkit_has_farm_access(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.farmkit_can_read_farm_metadata(target_farm_id);
$$;

create or replace function public.farmkit_has_farm_role(
  target_farm_id uuid,
  role_keys text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_memberships fm
    join public.roles r on r.id = fm.role_id
    join public.farms f on f.id = target_farm_id
    where fm.auth_user_id = auth.uid()
      and fm.status = 'active'
      and r.key = any(role_keys)
      and (fm.farm_id = target_farm_id or fm.farm_id = f.parent_farm_id)
  );
$$;

create or replace function public.farmkit_can_view_profile(target_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_memberships fm_admin
    join public.roles r on r.id = fm_admin.role_id
    join public.farm_memberships fm_target
      on fm_target.auth_user_id = target_auth_user_id
    join public.farms f on f.id = fm_target.farm_id
    where fm_admin.auth_user_id = auth.uid()
      and fm_admin.status = 'active'
      and r.key in ('admin', 'manager')
      and (
        fm_admin.farm_id = fm_target.farm_id
        or fm_admin.farm_id = f.parent_farm_id
      )
  );
$$;

create or replace function public.farmkit_container_farm_id(target_container_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select farm_id
  from public.containers
  where id = target_container_id;
$$;

create or replace function public.farmkit_effective_module_farm_id(target_farm_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select f.parent_farm_id from public.farms f where f.id = target_farm_id),
    target_farm_id
  );
$$;

create or replace function public.farmkit_module_enabled(
  target_farm_id uuid,
  module_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select fm.enabled
      from public.farm_modules fm
      join public.modules m on m.id = fm.module_id
      where fm.farm_id = public.farmkit_effective_module_farm_id(target_farm_id)
        and m.key = module_key
    ),
    (
      select m.default_enabled
      from public.modules m
      where m.key = module_key
    ),
    false
  );
$$;

create or replace function public.farmkit_is_parent_farm(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farms f
    where f.id = target_farm_id
      and f.parent_farm_id is null
  );
$$;

create or replace function public.farmkit_can_configure_modules(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.farmkit_is_parent_farm(target_farm_id)
    and public.farmkit_has_farm_role(target_farm_id, array['admin']);
$$;

create or replace function public.farmkit_is_shared_account(target_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_memberships fm
    where fm.auth_user_id = target_auth_user_id
      and fm.status = 'active'
      and fm.account_mode = 'shared'
  );
$$;

create or replace function public.farmkit_is_shared_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.farm_memberships fm
    join public.farms f on f.id = target_farm_id
    where fm.auth_user_id = auth.uid()
      and fm.status = 'active'
      and fm.account_mode = 'shared'
      and (fm.farm_id = target_farm_id or fm.farm_id = f.parent_farm_id)
  );
$$;

create or replace function public.farmkit_container_kind(target_container_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select container_kind
  from public.containers
  where id = target_container_id;
$$;

-- helper functions: authenticated-only execution
do $$
declare fn text;
begin
  foreach fn in array array[
    'farmkit_can_access_farm_data(uuid)',
    'farmkit_can_read_farm_metadata(uuid)',
    'farmkit_has_farm_access(uuid)',
    'farmkit_has_farm_role(uuid, text[])',
    'farmkit_can_view_profile(uuid)',
    'farmkit_container_farm_id(uuid)',
    'farmkit_container_kind(uuid)',
    'farmkit_effective_module_farm_id(uuid)',
    'farmkit_module_enabled(uuid, text)',
    'farmkit_is_parent_farm(uuid)',
    'farmkit_can_configure_modules(uuid)',
    'farmkit_is_shared_account(uuid)',
    'farmkit_is_shared_member(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- roles (system catalog)
alter table public.roles enable row level security;
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select
  to authenticated
  using (auth.uid() is not null);

-- modules (system catalog)
alter table public.modules enable row level security;
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select
  to authenticated
  using (auth.uid() is not null);

-- farms
alter table public.farms enable row level security;
drop policy if exists farms_select on public.farms;
create policy farms_select on public.farms
  for select
  to authenticated
  using (public.farmkit_can_read_farm_metadata(id));

drop policy if exists farms_insert on public.farms;
create policy farms_insert on public.farms
  for insert
  to authenticated
  with check (
    public.farmkit_has_farm_role(parent_farm_id, array['admin'])
  );

drop policy if exists farms_update on public.farms;
create policy farms_update on public.farms
  for update
  to authenticated
  using (public.farmkit_has_farm_role(id, array['admin']))
  with check (public.farmkit_has_farm_role(id, array['admin']));

drop policy if exists farms_delete on public.farms;
create policy farms_delete on public.farms
  for delete
  to authenticated
  using (public.farmkit_has_farm_role(id, array['admin']));

-- farm_details
alter table public.farm_details enable row level security;
drop policy if exists farm_details_select on public.farm_details;
create policy farm_details_select on public.farm_details
  for select
  to authenticated
  using (public.farmkit_can_read_farm_metadata(farm_id));

drop policy if exists farm_details_insert on public.farm_details;
create policy farm_details_insert on public.farm_details
  for insert
  to authenticated
  with check (public.farmkit_has_farm_role(farm_id, array['admin']));

drop policy if exists farm_details_update on public.farm_details;
create policy farm_details_update on public.farm_details
  for update
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin']))
  with check (public.farmkit_has_farm_role(farm_id, array['admin']));

drop policy if exists farm_details_delete on public.farm_details;
create policy farm_details_delete on public.farm_details
  for delete
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin']));

-- farm_erp
alter table public.farm_erp enable row level security;
drop policy if exists farm_erp_select on public.farm_erp;
create policy farm_erp_select on public.farm_erp
  for select
  to authenticated
  using (
    public.farmkit_can_read_farm_metadata(farm_id)
    and public.farmkit_module_enabled(farm_id, 'erp')
  );

drop policy if exists farm_erp_insert on public.farm_erp;
create policy farm_erp_insert on public.farm_erp
  for insert
  to authenticated
  with check (
    public.farmkit_has_farm_role(farm_id, array['admin'])
    and public.farmkit_module_enabled(farm_id, 'erp')
  );

drop policy if exists farm_erp_update on public.farm_erp;
create policy farm_erp_update on public.farm_erp
  for update
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin'])
    and public.farmkit_module_enabled(farm_id, 'erp')
  )
  with check (
    public.farmkit_has_farm_role(farm_id, array['admin'])
    and public.farmkit_module_enabled(farm_id, 'erp')
  );

drop policy if exists farm_erp_delete on public.farm_erp;
create policy farm_erp_delete on public.farm_erp
  for delete
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin'])
    and public.farmkit_module_enabled(farm_id, 'erp')
  );

-- user_profiles
alter table public.user_profiles enable row level security;
drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select on public.user_profiles
  for select
  to authenticated
  using (
    auth.uid() = auth_user_id
    or public.farmkit_can_view_profile(auth_user_id)
  );

drop policy if exists user_profiles_insert on public.user_profiles;
create policy user_profiles_insert on public.user_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = auth_user_id
    and not public.farmkit_is_shared_account(auth_user_id)
  );

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update on public.user_profiles
  for update
  to authenticated
  using (
    auth.uid() = auth_user_id
    and not public.farmkit_is_shared_account(auth_user_id)
  )
  with check (
    auth.uid() = auth_user_id
    and not public.farmkit_is_shared_account(auth_user_id)
  );

drop policy if exists user_profiles_delete on public.user_profiles;
create policy user_profiles_delete on public.user_profiles
  for delete
  to authenticated
  using (
    auth.uid() = auth_user_id
    and not public.farmkit_is_shared_account(auth_user_id)
  );

-- farm_memberships
alter table public.farm_memberships enable row level security;
drop policy if exists farm_memberships_select on public.farm_memberships;
create policy farm_memberships_select on public.farm_memberships
  for select
  to authenticated
  using (
    auth.uid() = auth_user_id
    or public.farmkit_has_farm_role(farm_id, array['admin'])
  );

drop policy if exists farm_memberships_insert on public.farm_memberships;
create policy farm_memberships_insert on public.farm_memberships
  for insert
  to authenticated
  with check (public.farmkit_has_farm_role(farm_id, array['admin']));

drop policy if exists farm_memberships_update on public.farm_memberships;
create policy farm_memberships_update on public.farm_memberships
  for update
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin']))
  with check (public.farmkit_has_farm_role(farm_id, array['admin']));

drop policy if exists farm_memberships_delete on public.farm_memberships;
create policy farm_memberships_delete on public.farm_memberships
  for delete
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin']));

-- people
alter table public.people enable row level security;
drop policy if exists people_select on public.people;
create policy people_select on public.people
  for select
  to authenticated
  using (public.farmkit_can_access_farm_data(farm_id));

drop policy if exists people_insert on public.people;
create policy people_insert on public.people
  for insert
  to authenticated
  with check (public.farmkit_has_farm_role(farm_id, array['admin', 'manager']));

drop policy if exists people_update on public.people;
create policy people_update on public.people
  for update
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin', 'manager']))
  with check (public.farmkit_has_farm_role(farm_id, array['admin', 'manager']));

drop policy if exists people_delete on public.people;
create policy people_delete on public.people
  for delete
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin', 'manager']));

-- farm_modules
alter table public.farm_modules enable row level security;
drop policy if exists farm_modules_select on public.farm_modules;
create policy farm_modules_select on public.farm_modules
  for select
  to authenticated
  using (public.farmkit_can_read_farm_metadata(farm_id));

drop policy if exists farm_modules_insert on public.farm_modules;
create policy farm_modules_insert on public.farm_modules
  for insert
  to authenticated
  with check (public.farmkit_can_configure_modules(farm_id));

drop policy if exists farm_modules_update on public.farm_modules;
create policy farm_modules_update on public.farm_modules
  for update
  to authenticated
  using (public.farmkit_can_configure_modules(farm_id))
  with check (public.farmkit_can_configure_modules(farm_id));

drop policy if exists farm_modules_delete on public.farm_modules;
create policy farm_modules_delete on public.farm_modules
  for delete
  to authenticated
  using (public.farmkit_can_configure_modules(farm_id));

-- containers
alter table public.containers enable row level security;
drop policy if exists containers_select on public.containers;
create policy containers_select on public.containers
  for select
  to authenticated
  using (
    public.farmkit_can_access_farm_data(farm_id)
    and public.farmkit_module_enabled(farm_id, 'containers')
    and (
      container_kind <> 'building'
      or public.farmkit_module_enabled(farm_id, 'containers_buildings')
    )
  );

drop policy if exists containers_insert on public.containers;
create policy containers_insert on public.containers
  for insert
  to authenticated
  with check (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'containers')
    and (
      container_kind <> 'building'
      or public.farmkit_module_enabled(farm_id, 'containers_buildings')
    )
  );

drop policy if exists containers_update on public.containers;
create policy containers_update on public.containers
  for update
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'containers')
    and (
      container_kind <> 'building'
      or public.farmkit_module_enabled(farm_id, 'containers_buildings')
    )
  )
  with check (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'containers')
    and (
      container_kind <> 'building'
      or public.farmkit_module_enabled(farm_id, 'containers_buildings')
    )
    -- Managers can edit buildings, but cannot "add" buildings by converting other container kinds into buildings.
    and (
      public.farmkit_has_farm_role(farm_id, array['admin'])
      or container_kind = public.farmkit_container_kind(id)
    )
  );

drop policy if exists containers_delete on public.containers;
create policy containers_delete on public.containers
  for delete
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'containers')
    and (
      container_kind <> 'building'
      or public.farmkit_module_enabled(farm_id, 'containers_buildings')
    )
    and (
      container_kind <> 'building'
      or public.farmkit_has_farm_role(farm_id, array['admin'])
    )
  );

-- building_details
alter table public.building_details enable row level security;
drop policy if exists building_details_select on public.building_details;
create policy building_details_select on public.building_details
  for select
  to authenticated
  using (
    public.farmkit_can_access_farm_data(
      public.farmkit_container_farm_id(container_id)
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers'
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers_buildings'
    )
  );

drop policy if exists building_details_insert on public.building_details;
create policy building_details_insert on public.building_details
  for insert
  to authenticated
  with check (
    public.farmkit_has_farm_role(
      public.farmkit_container_farm_id(container_id),
      array['admin', 'manager']
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers'
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers_buildings'
    )
  );

drop policy if exists building_details_update on public.building_details;
create policy building_details_update on public.building_details
  for update
  to authenticated
  using (
    public.farmkit_has_farm_role(
      public.farmkit_container_farm_id(container_id),
      array['admin', 'manager']
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers'
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers_buildings'
    )
  )
  with check (
    public.farmkit_has_farm_role(
      public.farmkit_container_farm_id(container_id),
      array['admin', 'manager']
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers'
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers_buildings'
    )
  );

drop policy if exists building_details_delete on public.building_details;
create policy building_details_delete on public.building_details
  for delete
  to authenticated
  using (
    public.farmkit_has_farm_role(
      public.farmkit_container_farm_id(container_id),
      array['admin']
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers'
    )
    and public.farmkit_module_enabled(
      public.farmkit_container_farm_id(container_id),
      'containers_buildings'
    )
  );

-- equipment
alter table public.equipment enable row level security;
drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
  for select
  to authenticated
  using (
    public.farmkit_can_access_farm_data(farm_id)
    and public.farmkit_module_enabled(farm_id, 'equipment')
  );

drop policy if exists equipment_insert on public.equipment;
create policy equipment_insert on public.equipment
  for insert
  to authenticated
  with check (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'equipment')
  );

drop policy if exists equipment_update on public.equipment;
create policy equipment_update on public.equipment
  for update
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'equipment')
  )
  with check (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'equipment')
  );

drop policy if exists equipment_delete on public.equipment;
create policy equipment_delete on public.equipment
  for delete
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'equipment')
  );

-- maintenance_logs
alter table public.maintenance_logs enable row level security;
drop policy if exists maintenance_logs_select on public.maintenance_logs;
create policy maintenance_logs_select on public.maintenance_logs
  for select
  to authenticated
  using (
    public.farmkit_can_access_farm_data(farm_id)
    and public.farmkit_module_enabled(farm_id, 'maintenance')
  );

drop policy if exists maintenance_logs_insert on public.maintenance_logs;
create policy maintenance_logs_insert on public.maintenance_logs
  for insert
  to authenticated
  with check (
    public.farmkit_can_access_farm_data(farm_id)
    and public.farmkit_module_enabled(farm_id, 'maintenance')
    and created_by_auth_user_id = auth.uid()
    and (
      not public.farmkit_is_shared_member(farm_id)
      or entered_by_person_id is not null
    )
  );

drop policy if exists maintenance_logs_update on public.maintenance_logs;
create policy maintenance_logs_update on public.maintenance_logs
  for update
  to authenticated
  using (
    public.farmkit_can_access_farm_data(farm_id)
    and public.farmkit_module_enabled(farm_id, 'maintenance')
    and (
      public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
      or created_by_auth_user_id = auth.uid()
    )
    and (
      not public.farmkit_is_shared_member(farm_id)
      or created_by_auth_user_id = auth.uid()
    )
  )
  with check (
    public.farmkit_can_access_farm_data(farm_id)
    and public.farmkit_module_enabled(farm_id, 'maintenance')
    and (
      public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
      or created_by_auth_user_id = auth.uid()
    )
    and (
      not public.farmkit_is_shared_member(farm_id)
      or created_by_auth_user_id = auth.uid()
    )
  );

drop policy if exists maintenance_logs_delete on public.maintenance_logs;
create policy maintenance_logs_delete on public.maintenance_logs
  for delete
  to authenticated
  using (
    public.farmkit_has_farm_role(farm_id, array['admin', 'manager'])
    and public.farmkit_module_enabled(farm_id, 'maintenance')
    and not public.farmkit_is_shared_member(farm_id)
  );

commit;
