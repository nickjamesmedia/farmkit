import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import QuickLinks from '../components/QuickLinks';

type Props = {
  session: Session;
};

type Profile = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  default_farm_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type FarmRow = {
  id: string;
  name: string;
  parent_farm_id: string | null;
};

type FarmGroup = {
  id: string;
  name: string;
  children: FarmRow[];
};

type MembershipSummary = {
  farm_id: string;
  role_id: string | null;
  status: string | null;
  account_mode: 'personal' | 'shared' | null;
  display_name_override: string | null;
};

type RoleRow = {
  id: string;
  key: string;
  name: string;
};

function Account({ session }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [farmGroups, setFarmGroups] = useState<FarmGroup[]>([]);
  const [membershipByFarmId, setMembershipByFarmId] = useState<
    Record<string, MembershipSummary>
  >({});
  const [roleNameById, setRoleNameById] = useState<Record<string, string>>({});
  const [roleKeyById, setRoleKeyById] = useState<Record<string, string>>({});
  const [farmsLoading, setFarmsLoading] = useState(true);
  const [farmsError, setFarmsError] = useState<string | null>(null);
  const [isSharedAccount, setIsSharedAccount] = useState(false);
  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '-');
  const formatMembership = (membership?: MembershipSummary) => {
    if (!membership) return 'No membership';
    const roleName = membership.role_id ? roleNameById[membership.role_id] ?? membership.role_id : '-';
    const statusText = membership.status ?? '-';
    const modeText = membership.account_mode ?? '-';
    const nameOverride = membership.display_name_override || '-';
    return `Role: ${roleName}; Status: ${statusText}; Mode: ${modeText}; Name override: ${nameOverride}`;
  };
  const effectiveMembershipText = (farm: { id: string; parent_farm_id?: string | null }) => {
    const direct = membershipByFarmId[farm.id];
    if (direct) return formatMembership(direct);
    const parentFarmId = farm.parent_farm_id ?? null;
    if (!parentFarmId) return 'No membership';
    const parentMembership = membershipByFarmId[parentFarmId];
    if (!parentMembership) return 'No membership';
    const roleKey = parentMembership.role_id ? roleKeyById[parentMembership.role_id] : null;
    if (roleKey !== 'admin') return 'No membership';
    if (parentMembership.status && parentMembership.status !== 'active') return 'No membership';
    return `Inherited: ${formatMembership(parentMembership)} (from parent farm)`;
  };

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('user_profiles')
        .select('id, auth_user_id, display_name, default_farm_id, created_at, updated_at')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (!active) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile(data as Profile);
        setDisplayName(data.display_name ?? '');
      } else {
        setProfile(null);
        setDisplayName('');
      }
      setLoading(false);
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  useEffect(() => {
    let active = true;
    const loadFarms = async () => {
      setFarmsLoading(true);
      setFarmsError(null);

      const [
        { data: farmRows, error: farmsErr },
        { data: membershipRows, error: membershipErr },
        { data: roleRows, error: rolesErr },
      ] = await Promise.all([
        supabase.from('farms').select('id, name, parent_farm_id').order('name', { ascending: true }),
        supabase
          .from('farm_memberships')
          .select('farm_id, role_id, status, account_mode, display_name_override')
          .eq('auth_user_id', session.user.id),
        supabase.from('roles').select('id, key, name'),
      ]);

      if (!active) return;
      if (farmsErr) {
        setFarmsError(farmsErr.message);
        setFarmGroups([]);
        setMembershipByFarmId({});
        setRoleNameById({});
        setIsSharedAccount(false);
      } else {
        const farms = (farmRows as FarmRow[]) ?? [];
        const farmById = new Map<string, FarmRow>();
        farms.forEach((row) => {
          farmById.set(row.id, row);
        });

        if (membershipErr) {
          setFarmsError(membershipErr.message);
          setMembershipByFarmId({});
          setIsSharedAccount(false);
        } else {
          const membershipMap: Record<string, MembershipSummary> = {};
          (membershipRows as MembershipSummary[] | null)?.forEach((row) => {
            membershipMap[row.farm_id] = row;
          });
          setMembershipByFarmId(membershipMap);
          const sharedAccount = (membershipRows as MembershipSummary[] | null)?.some(
            (row) => row.account_mode === 'shared',
          );
          setIsSharedAccount(Boolean(sharedAccount));
        }

        if (rolesErr) {
          setFarmsError(rolesErr.message);
          setRoleNameById({});
          setRoleKeyById({});
        } else {
          const roleMap: Record<string, string> = {};
          const roleKeyMap: Record<string, string> = {};
          (roleRows as RoleRow[] | null)?.forEach((row) => {
            roleMap[row.id] = row.name;
            roleKeyMap[row.id] = row.key;
          });
          setRoleNameById(roleMap);
          setRoleKeyById(roleKeyMap);
        }

        const groupsMap = new Map<string, FarmGroup>();
        farms.forEach((row) => {
          const parentId = row.parent_farm_id ?? row.id;
          if (!groupsMap.has(parentId)) {
            const parentRow = farmById.get(parentId);
            groupsMap.set(parentId, {
              id: parentId,
              name: parentRow?.name ?? 'Unknown parent farm',
              children: [],
            });
          }
          if (row.parent_farm_id) {
            groupsMap.get(parentId)?.children.push(row);
          }
        });

        const groups = Array.from(groupsMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        groups.forEach((group) => {
          group.children.sort((a, b) => a.name.localeCompare(b.name));
        });
        setFarmGroups(groups);
      }
      setFarmsLoading(false);
    };

    loadFarms();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSharedAccount) {
      return;
    }
    setSaving(true);
    setError(null);
    setStatus('');

    const { error: upsertError } = await supabase.from('user_profiles').upsert(
      {
        id: profile?.id,
        auth_user_id: session.user.id,
        display_name: displayName.trim() || null,
        default_farm_id: profile?.default_farm_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id' },
    );

    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }

    setStatus('Profile updated.');
    setSaving(false);
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Account" />
      <div className="app">
        <QuickLinks />
        <div className="card stack">
          <h1>Account</h1>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              <form className="stack" onSubmit={handleSubmit}>
                <label className="stack">
                  <span>Email</span>
                  <input type="email" value={session.user.email} disabled />
                </label>

                <label className="stack">
                  <span>Display name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jane Doe"
                    readOnly={isSharedAccount}
                  />
                </label>

                {!isSharedAccount && (
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                )}

                {status && <p className="status">{status}</p>}
                {error && <p className="status">{error}</p>}
              </form>

              <div className="stack">
                <h2>Profile metadata</h2>
                <div className="stack">
                  <div>
                    <strong>Profile created:</strong> {formatDate(profile?.created_at)}
                  </div>
                  <div>
                    <strong>Profile updated:</strong> {formatDate(profile?.updated_at)}
                  </div>
                  <div>
                    <strong>Last sign-in:</strong> {formatDate(session.user.last_sign_in_at)}
                  </div>
                </div>
              </div>

              <div className="stack">
                <h2>My Farms</h2>
                {farmsLoading && <p>Loading farms...</p>}
                {farmsError && <p className="status">{farmsError}</p>}
                {!farmsLoading && !farmsError && farmGroups.length === 0 && (
                  <p>No farm memberships yet.</p>
                )}
                {!farmsLoading && farmGroups.length > 0 && (
                  <div className="stack" style={{ gap: '1.25rem' }}>
                    {farmGroups.map((group) => (
                      <div key={group.id} className="stack" style={{ gap: '0.6rem' }}>
                        <div className="stack" style={{ gap: '0.25rem' }}>
                          <h3 style={{ margin: 0 }}>{group.name}</h3>
                          <div style={{ color: '#475569' }}>
                            <strong>Membership:</strong>{' '}
                            {effectiveMembershipText(group)}
                          </div>
                        </div>
                        {group.children.length === 0 ? (
                          <p style={{ margin: 0 }}>No child farms.</p>
                        ) : (
                          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
                            {group.children.map((farm) => (
                              <li
                                key={farm.id}
                                className="stack"
                                style={{
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  padding: '0.75rem 0.9rem',
                                  gap: '0.35rem',
                                }}
                              >
                                <h4 style={{ margin: 0 }}>{farm.name}</h4>
                                <div style={{ color: '#475569' }}>
                                  <strong>Membership:</strong>{' '}
                                  {effectiveMembershipText(farm)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Account;
