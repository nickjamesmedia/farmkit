-- Team member listing + invite audit support.
--
-- Deploy after 0002_rls_policies.sql. Rollback:
--   drop function public.farmkit_auth_user_id_by_email(text);
--   drop function public.farmkit_team_members(uuid);
--   drop table public.farm_team_invites;
--   alter table public.farm_memberships drop column if exists invited_email;
--   alter table public.user_profiles drop column if exists email;

begin;

alter table public.user_profiles
  add column if not exists email text;

alter table public.farm_memberships
  add column if not exists invited_email text;

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

alter table public.farm_team_invites enable row level security;

drop policy if exists farm_team_invites_select on public.farm_team_invites;
create policy farm_team_invites_select on public.farm_team_invites
  for select
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin']));

drop policy if exists farm_team_invites_insert on public.farm_team_invites;
create policy farm_team_invites_insert on public.farm_team_invites
  for insert
  to authenticated
  with check (public.farmkit_has_farm_role(farm_id, array['admin']));

drop policy if exists farm_team_invites_update on public.farm_team_invites;
create policy farm_team_invites_update on public.farm_team_invites
  for update
  to authenticated
  using (public.farmkit_has_farm_role(farm_id, array['admin']))
  with check (public.farmkit_has_farm_role(farm_id, array['admin']));

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

commit;
