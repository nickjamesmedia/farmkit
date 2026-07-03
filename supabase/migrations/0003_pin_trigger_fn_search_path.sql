-- Pin search_path on remaining trigger/helper functions (Supabase advisor 0011)
alter function public.farmkit_enforce_two_level_farms() set search_path = public, pg_temp;
alter function public.farmkit_sync_admin_child_memberships_from_parent_membership() set search_path = public, pg_temp;
alter function public.farmkit_sync_admin_child_memberships_from_farm_change() set search_path = public, pg_temp;
alter function public.farmkit_ensure_admin_child_farm_memberships() set search_path = public, pg_temp;
