# Farmkit v0.1 demo seed data

Source: `supabase/seed_v0_1_demo.sql`

## What the seed includes
- Roles: admin, manager, user
- Modules: equipment, buildings, maintenance
- Farms: 2 primary farms + 2 child locations
- Farm details: address/contact/emergency fields for each farm
- Users: 5 auth users (must exist in Supabase Auth before running the seed)
- Memberships: admin/manager/user + shared account membership
- People: 10 farm people for shared-login attribution and user-linked profiles
- Containers: 4 buildings + parts room + shelf + 2 yards
- Building details: 4 building detail rows
- Equipment: 22 items
- Maintenance logs: 45 logs (44 equipment + 1 building)

## Required auth users
Create these users in Supabase Auth (recommended password '`FarmkitDemo1!`')before running the seed:
- `laura.admin@example.ca` (admin, primary farm)
- `devon.manager@example.ca` (manager, east quarter)
- `samir.user@example.ca` (user, north yard)
- `shop.shared@example.ca` (shared login, primary farm)
- `harper.admin@example.ca` (admin, Maple Ridge Farms)

## Farms (structure)
- Primary farm: Prairie Valley Farms
- Child farms: Prairie Valley Farms - East Quarter, Prairie Valley Farms - North Yard
- Primary farm: Maple Ridge Farms

## Seeded entities (high level)
- Roles: 3
- Modules: 3
- Farms: 4
- Farm details: 4
- User profiles: 5
- Farm memberships: 5
- People: 10
- Containers: 8
- Building details: 4
- Equipment: 22
- Maintenance logs: 45

## Notes
- The seed uses fixed UUIDs and explicit `::uuid` casts.
- It creates a temporary `seed_auth_users` table and drops it at the end.
- Run order: `supabase/schema.sql` first, then `supabase/seed_v0_1_demo.sql`.
- Each personal user has a linked `people` row; shared accounts do not.
