import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { fetchActiveFarmContext } from './farmContext';

type FarmDetails = {
  favicon_url: string | null;
  logo_url: string | null;
};

type FarmRow = {
  id: string;
  name: string | null;
  slug: string | null;
  parent_farm_id?: string | null;
  farm_details: FarmDetails | FarmDetails[] | null;
};

type ModuleRow = {
  id: string;
  key: string;
  default_enabled: boolean;
};

type FarmModuleRow = {
  module_id: string;
  enabled: boolean;
};

type RoleRow = {
  id: string;
  key: 'admin' | 'manager' | 'user';
};

type NavData = {
  loading: boolean;
  error: string | null;
  displayName: string | null;
  farmName: string | null;
  farmFavicon: string | null;
  farmLogo: string | null;
  activeFarmId: string | null;
  roleKey: 'admin' | 'manager' | 'user' | null;
  moduleOwnerFarmId: string | null;
  dataScopeFarmIds: string[];
  moduleEnabledByKey: Record<string, boolean>;
  email: string | null;
};

const defaultNavData: NavData = {
  loading: false,
  error: null,
  displayName: null,
  farmName: null,
  farmFavicon: null,
  farmLogo: null,
  activeFarmId: null,
  roleKey: null,
  moduleOwnerFarmId: null,
  dataScopeFarmIds: [],
  moduleEnabledByKey: {},
  email: null,
};

const NavDataContext = createContext<NavData | null>(null);

type NavDataProviderProps = {
  session: Session | null;
  children: ReactNode;
};

export function NavDataProvider({ session, children }: NavDataProviderProps) {
  const [navData, setNavData] = useState<NavData>(() => ({
    ...defaultNavData,
    loading: Boolean(session?.user),
    email: session?.user.email ?? null,
  }));

  useEffect(() => {
    let active = true;

    const loadNavData = async () => {
      if (!session?.user) {
        setNavData({
          ...defaultNavData,
          email: session?.user.email ?? null,
        });
        return;
      }

      setNavData({
        ...defaultNavData,
        loading: true,
        email: session?.user.email ?? null,
      });

      try {
        const { farmId, profile, membership } = await fetchActiveFarmContext(
          session.user.id,
        );

        let farm: FarmRow | null = null;
        let displayFarm: FarmRow | null = null;
        let moduleOwnerFarmId: string | null = null;
        let dataScopeFarmIds: string[] = [];
        let moduleEnabledByKey: Record<string, boolean> = {};
        let roleKey: 'admin' | 'manager' | 'user' | null = null;

        if (farmId) {
          const { data, error } = await supabase
            .from('farms')
            .select(
              'id, name, slug, parent_farm_id, farm_details:farm_details(favicon_url, logo_url)',
            )
            .eq('id', farmId)
            .maybeSingle();

          if (error) {
            throw error;
          }

          farm = (data as FarmRow) ?? null;
          moduleOwnerFarmId = farm?.parent_farm_id ?? farm?.id ?? null;

          const membershipFarmIds = [
            farm?.id ?? null,
            farm?.parent_farm_id ?? null,
          ].filter(Boolean) as string[];
          if (membershipFarmIds.length) {
            const { data: membershipRows } = await supabase
              .from('farm_memberships')
              .select('farm_id, role_id')
              .eq('auth_user_id', session.user.id)
              .eq('status', 'active')
              .in('farm_id', membershipFarmIds);

            const roleIds = Array.from(
              new Set(
                ((membershipRows as { role_id: string | null }[]) ?? [])
                  .map((row) => row.role_id)
                  .filter(Boolean) as string[],
              ),
            );

            if (roleIds.length) {
              const { data: roleRows } = await supabase
                .from('roles')
                .select('id, key')
                .in('id', roleIds);
              const roleKeyById = new Map(
                ((roleRows as RoleRow[]) ?? []).map((row) => [row.id, row.key]),
              );
              const rank: Record<RoleRow['key'], number> = {
                admin: 3,
                manager: 2,
                user: 1,
              };
              const best = roleIds
                .map((id) => roleKeyById.get(id))
                .filter(Boolean)
                .sort((a, b) => rank[b!] - rank[a!])[0];
              roleKey = best ?? null;
            }
          }

          if (farm?.parent_farm_id) {
            const { data: parentFarm, error: parentError } = await supabase
              .from('farms')
              .select(
                'id, name, slug, farm_details:farm_details(favicon_url, logo_url)',
              )
              .eq('id', farm.parent_farm_id)
              .maybeSingle();

            if (!parentError && parentFarm) {
              displayFarm = parentFarm as FarmRow;
            } else {
              displayFarm = farm;
            }
          } else {
            displayFarm = farm;
          }

          // Data scope: if active farm is a parent farm, include its child farms.
          if (farm && !farm.parent_farm_id) {
            const { data: childRows } = await supabase
              .from('farms')
              .select('id')
              .eq('parent_farm_id', farm.id);
            const children = ((childRows as { id: string }[]) ?? []).map(
              (row) => row.id,
            );
            dataScopeFarmIds = [farm.id, ...children];
          } else if (farm?.id) {
            dataScopeFarmIds = [farm.id];
          }

          // Module flags: always sourced from the parent farm (or self if parent).
          if (moduleOwnerFarmId) {
            const [
              { data: moduleRows, error: modulesErr },
              { data: farmModuleRows, error: farmModulesErr },
            ] = await Promise.all([
              supabase
                .from('modules')
                .select('id, key, default_enabled')
                .order('name', { ascending: true }),
              supabase
                .from('farm_modules')
                .select('module_id, enabled')
                .eq('farm_id', moduleOwnerFarmId),
            ]);

            if (!modulesErr && !farmModulesErr) {
              const moduleList = (moduleRows as ModuleRow[]) ?? [];
              const enabledByModuleId = new Map(
                ((farmModuleRows as FarmModuleRow[]) ?? []).map((row) => [
                  row.module_id,
                  row.enabled,
                ]),
              );
              moduleEnabledByKey = moduleList.reduce<Record<string, boolean>>(
                (acc, row) => {
                  acc[row.key] = enabledByModuleId.get(row.id) ?? row.default_enabled;
                  return acc;
                },
                {},
              );
            }
          }
        }

        if (!active) return;

        const details = Array.isArray(displayFarm?.farm_details)
          ? displayFarm?.farm_details?.[0]
          : displayFarm?.farm_details;

        setNavData({
          loading: false,
          error: null,
          displayName:
            membership?.display_name_override ?? profile?.display_name ?? null,
          farmName: displayFarm?.name ?? null,
          farmFavicon: details?.favicon_url ?? null,
          farmLogo: details?.logo_url ?? null,
          activeFarmId: farmId,
          roleKey,
          moduleOwnerFarmId,
          dataScopeFarmIds,
          moduleEnabledByKey,
          email: session?.user.email ?? null,
        });
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load farm profile.';
        setNavData({
          ...defaultNavData,
          loading: false,
          error: message,
          email: session?.user.email ?? null,
        });
      }
    };

    loadNavData();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  return (
    <NavDataContext.Provider value={navData}>
      {children}
    </NavDataContext.Provider>
  );
}

export function useNavData() {
  const context = useContext(NavDataContext);
  if (!context) {
    throw new Error('useNavData must be used within NavDataProvider.');
  }
  return context;
}
