# RLS Plan (v0.1 draft)

## Purpose

Define the row-level security scope and access patterns for the v0.1 data model. This is a planning doc only and does not include SQL policy definitions.

## Scope (v0.1 tables)

Core tables that need explicit RLS coverage for the beta launch:

- farms, farm_details, farm_memberships, farm_modules
- roles, modules
- user_profiles, people
- equipment
- containers, building_details
- maintenance_logs, maintenance_tasks, maintenance_parts_used
- tags, tag_links (only if tags ship in v0.1)
- farm_invites (deferred to v0.2; exclude from v0.1 RLS)

## Baseline rules

- RLS is the source of truth for access control; UI filtering is not security.
- Default deny. Every table must have explicit policies.
- Access is scoped by active rows in `farm_memberships`.
- Authentication uses `auth.uid()`; no reliance on client-supplied user ids.
- Service role bypass is used only for admin or bootstrap workflows.

## Policy patterns (draft)

### Farm-scoped data (tables with `farm_id`)

Applies to: farms, farm_details, farm_modules, people, equipment, containers, building_details, maintenance_logs, maintenance_tasks, maintenance_parts_used, tags, tag_links.

- Select: any authenticated user with an active membership in the farm.
- Insert: admin or manager for the farm.
- Update: admin or manager for the farm.
- Delete: admin or manager for the farm.
- Module gating: if the related module is disabled for the farm, hide all rows (select/insert/update/delete).

Exception candidates:

- maintenance_logs: allow users to insert logs and edit only their own logs; delete limited to admin/manager.
- people: only admin/manager can insert or update people records.
- farms/farm_details: admin only for writes.
- farms: top-level farm creation is not allowed in-app (child farms only, under an existing parent).

### Membership and invites

Applies to: farm_memberships. (farm_invites deferred to v0.2)

- Select: admin/manager for the farm; users can read their own membership row.
- Insert: admin/manager for the farm (invite or add membership).
- Update: admin/manager for the farm (role changes, status changes).
- Delete: admin or manager.

### User-scoped profile

Applies to: user_profiles.

- Select: the authenticated user can read their own profile.
- Insert/Update: the authenticated user can manage their own profile.
- Admin read access.

### System catalogs

Applies to: roles, modules.

- Select: read-only for authenticated users.
- Insert/Update/Delete: service role only.

### Shared accounts

- Shared accounts cannot insert/update/delete their own `user_profiles` rows.
- Shared accounts can insert maintenance logs and can update logs they created (e.g., to close status).
- Shared accounts cannot delete maintenance logs.

## Farm hierarchy access

Parent farm membership grants access to child farm data by default.
Child-farm membership grants read access to the parent farm and farm_details rows.

## Answered questions

- Should users be able to create or edit maintenance logs, or is that manager/admin only?
  - Users can read all maintenance logs for their farm. Users can create maintenance logs. Users can edit their own maintenance logs. Only managers or admins can delete a maintenance log.
- Can users create or edit people records, or should that be restricted?
  - Users can read and select people records. Only managers/admins can add people.
- Are managers allowed to delete records, or is delete admin-only?
  - Managers can delete records.
- Does the admin UI require cross-farm visibility from the parent farm?
  - HQ admin can see/manage all child-farm data by default.
- Should farm_invites be included in v0.1, or deferred?
  - Defer farm invites to v0.2.
