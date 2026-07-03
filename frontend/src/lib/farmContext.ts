import { supabase } from './supabaseClient';

export type UserProfile = {
  auth_user_id: string;
  display_name: string | null;
  default_farm_id: string | null;
};

export type FarmMembership = {
  id: string;
  farm_id: string;
  auth_user_id: string;
  role_id: string | null;
  status: string | null;
  account_mode: 'personal' | 'shared';
  person_id: string | null;
  display_name_override: string | null;
};

export type ActiveFarmContext = {
  farmId: string | null;
  profile: UserProfile | null;
  membership: FarmMembership | null;
};

export async function fetchActiveFarmContext(
  authUserId: string,
): Promise<ActiveFarmContext> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('auth_user_id, display_name, default_farm_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  let farmId = profile?.default_farm_id ?? null;
  let membership: FarmMembership | null = null;

  if (!farmId) {
    const { data: membershipRow } = await supabase
      .from('farm_memberships')
      .select(
        'id, farm_id, auth_user_id, role_id, status, account_mode, person_id, display_name_override',
      )
      .eq('auth_user_id', authUserId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipRow) {
      membership = membershipRow as FarmMembership;
      farmId = membershipRow.farm_id ?? null;
    }
  }

  if (farmId && !membership) {
    const { data: membershipRow } = await supabase
      .from('farm_memberships')
      .select(
        'id, farm_id, auth_user_id, role_id, status, account_mode, person_id, display_name_override',
      )
      .eq('auth_user_id', authUserId)
      .eq('farm_id', farmId)
      .maybeSingle();
    membership = (membershipRow as FarmMembership) ?? null;
  }

  return { farmId, profile: (profile as UserProfile) ?? null, membership };
}
