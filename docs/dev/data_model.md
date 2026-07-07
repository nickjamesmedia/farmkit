# farmkit: Module & Database Tree (Working)

## System (always-on)

### Auth (Supabase-managed)

* `auth.users` *(managed by Supabase)*
* `auth.sessions` / tokens *(managed)*

### Tenant / Farm

* `farms`

  * Purpose: one row per farm/tenant.
  * schema:

    * `id` (uuid, pk)
    * `name` (text)
    * `slug` (text, unique per deployment)
    * `parent_farm_id` (uuid, fk → farms, nullable) *(allows parent/child farm hierarchy)*
      *(Terminology, 2026-07-06: child farms are called **"Sub-farms"** in all user-facing UI/docs — never "locations", which is reserved for where equipment/buildings physically live.)*
    * `timezone` (text, optional; default America/Edmonton)
    * `status` (text: active/archived)
    * `created_at` (timestamptz)
    * `created_by_auth_user_id` (uuid, fk → auth.users, nullable)

* `farm_details` *(1:1 with farms; holds “location/site + branding/contact” data)*

  * Purpose: accommodates prototype `locations` + farm contact/branding fields without bloating `farms`.
  * schema (suggested for V0.1 parity):

    * `farm_id` (uuid, pk, fk → farms)
    * Site/address: `address_line1`, `address_line2`, `city`, `province`, `postal_code`, `country`
    * Geo: `latitude`, `longitude`
    * Ops context: `nearest_town`, `nearest_hospital_name`, `nearest_hospital_distance_km`
    * Primary contact: `primary_contact_name`, `primary_contact_phone`
    * Emergency: `emergency_instructions`
    * Storage flags: `has_fuel_storage`, `has_chemical_storage`
    * Farm contact: `email`, `phone`, `website_url`
    * App/branding: `app_url`, `favicon_url`, `logo_url`
    * Notes/audit: `notes`, `created_at`, `updated_at`, `updated_by_auth_user_id` (fk → auth.users, nullable)

* `farm_memberships` *(auth user ↔ farm)*** *(auth user ↔ farm)*

  * Purpose: who can access which farm + what they can do + whether login is shared.
  * schema:

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `auth_user_id` (uuid, fk → auth.users)
    * `role_id` (uuid, fk → roles)
    * `status` (text: active/invited/disabled)
    * `account_mode` (text: personal/shared)
    * `person_id` (uuid, fk → people, nullable)
    * `invited_email` (text, nullable)
    * `display_name_override` (text, nullable) *(optional: label for shared logins like “Shop Tablet”)*
    * `inherited_from_farm_id` (uuid, fk → farms, nullable)
    * `created_at` (timestamptz)
    * `created_by_auth_user_id` (uuid, fk → auth.users, nullable)
    * `last_seen_at` (timestamptz, nullable) *(optional)*

* `roles`

  * Purpose: permission tiers (V0.1: admin/manager/user).
  * schema:

    * `id` (uuid, pk)
    * `key` (text: admin/manager/user)
    * `name` (text)
    * `description` (text, nullable)
    * `is_system` (bool)
    * `created_at` (timestamptz)

* `role_permissions` *(future RBAC)*

  * Purpose: optional fine-grained permissions layered on roles.
  * schema:

    * `id` (uuid, pk)
    * `role_id` (uuid, fk → roles)
    * `permission_key` (text) *(e.g., equipment.write, users.manage)*
    * `effect` (text: allow/deny)
    * `created_at` (timestamptz)

* `modules`

  * Purpose: catalog of feature modules (buildings, buildings.storage, etc.).
  * schema:

    * `id` (uuid, pk)
    * `key` (text) *(e.g., buildings, buildings.storage)*
    * `name` (text)
    * `description` (text, nullable)
    * `is_system` (bool)
    * `created_at` (timestamptz)

* `farm_modules` *(farm ↔ module, enabled)*

  * Purpose: toggle modules per farm.
  * schema:

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `module_id` (uuid, fk → modules)
    * `enabled` (bool)
    * `enabled_at` (timestamptz, nullable)
    * `updated_at` (timestamptz)
    * `updated_by_auth_user_id` (uuid, fk → auth.users, nullable)

* `farm_team_invites`

  * Purpose: audit and rate-limit email invites sent through the Supabase Edge Function.
  * schema:

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `email` (text)
    * `auth_user_id` (uuid, fk → auth.users, nullable)
    * `role_id` (uuid, fk → roles)
    * `account_mode` (text: personal/shared)
    * `display_name` (text, nullable)
    * `status` (text: sent/accepted/revoked/failed)
    * `created_by_auth_user_id` (uuid, fk → auth.users)
    * `created_at` (timestamptz)
    * `last_sent_at`, `revoked_at`, `accepted_at` (timestamptz, nullable)
    * `error_message` (text, nullable)

### Identity: Named People + Shared Accounts (V0.1 beta launch)

**Goal:** support log attribution when multiple real people share one login.

* `user_profiles`

  * Purpose: profile metadata for authenticated users (cross-farm friendly).
  * schema (V0.1):

    * `id` (uuid, pk)
    * `auth_user_id` (uuid, fk → auth.users, unique)
    * `email` (text, nullable)
    * `display_name` (text, nullable)
    * `default_farm_id` (uuid, fk → farms, nullable) *(optional: which farm to open by default)*
    * `created_at` (timestamptz)
    * `updated_at` (timestamptz, nullable)

* `people`

  * Purpose: directory of real individuals on a farm (used for attribution + selection in shared logins).
  * schema (V0.1):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `first_name` (text)
    * `last_name` (text, nullable)
    * `display_name` (text, nullable) *(optional override; otherwise derived)*
    * `active` (bool)
    * `notes` (text, nullable)
    * `created_at` (timestamptz)
    * `updated_at` (timestamptz, nullable)

* `shared_account_settings` *(not needed for V0.1; add later if you need extra shared-login knobs)*

  * Purpose: optional per-membership settings for shared logins.
  * schema (future):

    * `id` (uuid, pk)
    * `farm_membership_id` (uuid, fk → farm_memberships, unique)
    * `require_person_select` (bool)
    * `default_person_id` (uuid, fk → people, nullable)
    * `created_at` (timestamptz)
    * `updated_at` (timestamptz, nullable)

### Cross-cutting system tables (optional but common)

* `tags` *(recommended for V0.1 if you want filtering/grouping early; otherwise add later)*

  * Purpose: tag definitions per farm.
  * schema:

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `key` (text, nullable) *(optional machine-friendly slug)*
    * `name` (text) *(display label)*
    * `color` (text, nullable) *(optional)*
    * `created_at` (timestamptz)

* `tag_links` *(polymorphic; add in V0.1 only if tags ship)*

  * Purpose: attaches tags to any entity.
  * schema:

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `tag_id` (uuid, fk → tags)
    * `entity_type` (text) *(e.g., equipment, maintenance_logs, containers)*
    * `entity_id` (uuid)
    * `created_at` (timestamptz)

* `categories` *(future; scoped per farm + entity type)*

  * Purpose: user-defined categories used as primary grouping (distinct from tags).
  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `scope` (text) *(e.g., equipment, containers, maintenance_logs)*
    * `name` (text)
    * `key` (text, nullable)
    * `created_at` (timestamptz)

* `attachments` *(future; add when you ship file uploads)*

  * Purpose: global file linkage for any entity; files stored in Supabase Storage.
  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `entity_type` (text)
    * `entity_id` (uuid)
    * `storage_bucket` (text)
    * `storage_path` (text)
    * `filename` (text)
    * `content_type` (text, nullable)
    * `size_bytes` (bigint, nullable)
    * `created_at` (timestamptz)
    * `created_by_auth_user_id` (uuid, fk → auth.users, nullable)

* `comments` *(future; add when you want notes threads separate from logs)*

  * Purpose: user-written comments on any entity.
  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `entity_type` (text)
    * `entity_id` (uuid)
    * `body` (text)
    * Attribution: `created_by_auth_user_id` (fk → auth.users, nullable), `entered_by_person_id` (fk → people, nullable)
    * `created_at` (timestamptz)

* `activity_events` *(future; add when you want a global timeline)*

  * Purpose: system-generated timeline events (with optional references to the “real” record).
  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `event_type` (text) *(e.g., maintenance_log_created, status_changed)*
    * `entity_type` (text)
    * `entity_id` (uuid)
    * Optional reference: `ref_entity_type` (text, nullable), `ref_entity_id` (uuid, nullable)
    * `summary` (text, nullable)
    * Attribution: `created_by_auth_user_id` (fk → auth.users, nullable), `entered_by_person_id` (fk → people, nullable)
    * `created_at` (timestamptz)

* `notifications` *(future; add when you ship an in-app inbox)*

  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `user_id` (uuid, fk → auth.users)
    * `reminder_id` (uuid, fk → reminders, nullable)
    * `title` (text)
    * `body` (text, nullable)
    * `severity` (text, nullable)
    * `read_at` (timestamptz, nullable)
    * `dismissed_at` (timestamptz, nullable)
    * `created_at` (timestamptz)

* `reminders` *(future; add when you ship scheduling)*

  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * Target: `entity_type` (text), `entity_id` (uuid)
    * Rule: `rule_type` (text) *(date/interval/meter)*, `rule_json` (jsonb, nullable)
    * `next_run_at` (timestamptz, nullable)
    * `active` (bool)
    * `snoozed_until` (timestamptz, nullable)
    * `created_at` (timestamptz)
    * `created_by_auth_user_id` (uuid, fk → auth.users, nullable)

* `farm_settings` *(future; add when you want configurable defaults beyond farm_details)*

  * schema (future):

    * `farm_id` (uuid, pk, fk → farms)
    * `settings` (jsonb)
    * `updated_at` (timestamptz)
    * `updated_by_auth_user_id` (uuid, fk → auth.users, nullable)

* `audit_log` *(future; add if you need full change tracking)*

  * schema (future):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `action` (text)
    * `entity_type` (text)
    * `entity_id` (uuid, nullable)
    * `details` (jsonb, nullable)
    * Attribution: `auth_user_id` (fk → auth.users, nullable), `person_id` (fk → people, nullable)
    * `created_at` (timestamptz)

---

## Core Modules (V0.1 beta launch)

### Equipment

* `equipment`

  * Purpose: track farm equipment and its core details.
  * schema (V0.1 parity with prototype):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * Location:

      * `home_container_id` (uuid, fk → containers, nullable) *(where it’s normally stored)*
      * `current_container_id` (uuid, fk → containers, nullable) *(where it is right now, if tracked)*
    * Classification:

      * `category` (text) *(prototype parity; can migrate to scoped `categories` later)*
    * Identity:

      * `make` (text, nullable)
      * `model` (text, nullable)
      * `nickname` (text, nullable)
      * `serial_number` (text, nullable)
      * `vin_sn` (text, nullable)
      * `unit_number` (text, nullable)
      * `year` (int, nullable)
      * `year_of_purchase` (int, nullable)
      * `license_class` (text, nullable)
    * Service/inspection dates (prototype parity; reminders can replace later):

      * `next_service_at` (date, nullable)
      * `cvip_expires_at` (date, nullable)
      * `insurance_expires_at` (date, nullable)
    * Common parts refs (prototype parity; inventory can replace later):

      * `oil_filter_number` (text, nullable)
      * `fuel_filter_number` (text, nullable)
      * `air_filter_number` (text, nullable)
    * Status:

      * `active` (bool)
      * `notes` (text, nullable)
    * Audit:

      * `created_at` (timestamptz)
      * `created_by_auth_user_id` (uuid, fk → auth.users, nullable)
      * `updated_at` (timestamptz, nullable)
      * `updated_by_auth_user_id` (uuid, fk → auth.users, nullable)

### Maintenance

* `maintenance_logs` *(includes attribution to the login and, for shared logins, the selected person)*
* `maintenance_tasks` *(templates)*
* `maintenance_parts_used` *(future link to inventory, for tracking purposes to start)*

### Buildings (optional module;  “core-ish”)

#### One Containers Tree Model (buildings + nested storage)

* `containers`

  * Purpose: a unified hierarchy for buildings + nested storage (rooms/shelves/bins/etc.).
  * schema (V0.1):

    * `id` (uuid, pk)
    * `farm_id` (uuid, fk → farms)
    * `parent_id` (uuid, fk → containers, nullable)
    * `container_kind` (text) *(e.g., building, room, shelf, locker, bin, tank, tote, other)*
    * `name` (text)
    * `code` (text, nullable)
    * `description` (text, nullable)
    * `notes` (text, nullable)
    * `active` (bool)
    * Audit:

      * `created_at` (timestamptz)
      * `created_by_auth_user_id` (uuid, fk → auth.users, nullable)
      * `updated_at` (timestamptz, nullable)
      * `updated_by_auth_user_id` (uuid, fk → auth.users, nullable)

* `container_contents` *(current snapshot)*

* `container_movements` *(history/audit)*

**Optional extension tables:**

* `building_details` *(1:1 with container where kind=building; included for V0.1 beta launch)*

  * Purpose: holds building-only fields (prototype parity) without bloating `containers`.
  * schema (V0.1):

    * `container_id` (uuid, pk, fk → containers)
    * `year_built` (int, nullable)
    * `heated` (bool, nullable)
    * `has_water` (bool, nullable)
    * `has_three_phase_power` (bool, nullable)
    * `capacity` (text, nullable)
    * `created_at` (timestamptz)
    * `updated_at` (timestamptz, nullable)
    * `updated_by_auth_user_id` (uuid, fk → auth.users, nullable)
* `grain_bin_details` *(1:1 with container where kind=grain_bin/silo; add later if needed)*

---

## Future Modules (discussed at high level)

### Livestock (future)

* `animals`
* `herds` / `groups`
* `weights`
* `treatments`
* `breeding`
* `movements`

### Maps / Spatial Tools (future)

* `map_layers` *(logical layers: fields, yards, zones, etc.)*
* `map_features` *(points/lines/polygons; lightweight GIS features)*
* `feature_links` *(optional links between map features and entities like equipment, containers, buildings)*

---

## UI/UX Notes for Shared Accounts (V0.1 beta launch)

### Log attribution behavior

* Personal login: attribution defaults to the logged-in user
* Shared login: require selecting a person from `people` (dropdown + type-to-filter)

### Permissions

* Shared logins should generally have minimal permissions (often `user`)
* Admin/manager access should ideally be personal logins

---

## Notes / assumptions

* Farm-owned data is scoped per farm for RLS.
* Global `attachments` is preferred over per-module `*_files` tables.
* If committing to the Containers model, buildings can be represented as top-level containers (no separate `buildings` table required).
