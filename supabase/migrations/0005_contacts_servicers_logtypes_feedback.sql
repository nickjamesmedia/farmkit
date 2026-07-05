-- v0.1.1 review-notes data model:
--   * account contact info (user_profiles.phone; email added in 0004)
--   * People become "People & Servicers": a person OR a company/shop
--   * maintenance_logs gain a type (maintenance vs inspection)
--   * feedback/bug-report capture table
-- Apply after 0004_team_invites.sql. Rollback: drop the added columns/table.

begin;

-- accounts: optional phone (email already present from 0004)
alter table public.user_profiles
  add column if not exists phone text;

-- people can be a company/shop, not just a person
alter table public.people
  add column if not exists entity_type text not null default 'person';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'people_entity_type_check'
  ) then
    alter table public.people
      add constraint people_entity_type_check
      check (entity_type in ('person', 'company'));
  end if;
end $$;

-- a company row has no first name; loosen the NOT NULL
alter table public.people
  alter column first_name drop not null;

-- companies must still have a display_name; persons must have a first name
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'people_name_present_check'
  ) then
    alter table public.people
      add constraint people_name_present_check
      check (
        (entity_type = 'company' and coalesce(nullif(display_name, ''), null) is not null)
        or (entity_type = 'person' and coalesce(nullif(first_name, ''), null) is not null)
      );
  end if;
end $$;

-- backfill: the legacy imported vendors/shops are companies
update public.people
set entity_type = 'company'
where entity_type = 'person'
  and notes is not null
  and notes ilike 'External vendor%';

-- maintenance_logs: maintenance vs inspection
alter table public.maintenance_logs
  add column if not exists log_type text not null default 'maintenance';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'maintenance_logs_log_type_check'
  ) then
    alter table public.maintenance_logs
      add constraint maintenance_logs_log_type_check
      check (log_type in ('maintenance', 'inspection'));
  end if;
end $$;

create index if not exists maintenance_logs_log_type_idx
  on public.maintenance_logs (log_type);

-- feedback / bug reports (app-wide; read by dev via service role only)
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  kind text not null default 'feedback' check (kind in ('feedback', 'bug')),
  message text not null,
  page_path text,
  page_title text,
  app_version text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- any signed-in user can file feedback as themselves; nobody can read via the
-- API (dev reads through the dashboard / service role), so reports never leak
-- across farms.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());

commit;
