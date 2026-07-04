import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchActiveFarmContext } from '../lib/farmContext';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type Role = {
  id: string;
  key: string;
  name: string;
};

type Membership = {
  id: string;
  farm_id: string;
  auth_user_id: string;
  role_id: string;
  status: 'active' | 'invited' | 'disabled';
  account_mode: 'personal' | 'shared';
  person_id: string | null;
  display_name_override: string | null;
  created_at: string;
  last_seen_at: string | null;
};

type Profile = {
  auth_user_id: string;
  display_name: string | null;
};

type MembershipForm = {
  id?: string;
  auth_user_id: string;
  role_id: string;
  status: 'active' | 'invited' | 'disabled';
  account_mode: 'personal' | 'shared';
  display_name_override: string;
};

function ManageUsers({ session }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [form, setForm] = useState<MembershipForm>({
    auth_user_id: '',
    role_id: '',
    status: 'active',
    account_mode: 'personal',
    display_name_override: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const roleMap = useMemo(() => {
    const map: Record<string, Role> = {};
    roles.forEach((role) => {
      map[role.id] = role;
    });
    return map;
  }, [roles]);

  const defaultRoleId = useMemo(() => {
    return roles.find((role) => role.key === 'user')?.id ?? roles[0]?.id ?? '';
  }, [roles]);

  const displayName = (membership: Membership) =>
    membership.display_name_override ||
    profileMap[membership.auth_user_id] ||
    membership.auth_user_id;

  const resetForm = () => {
    setForm({
      auth_user_id: '',
      role_id: defaultRoleId,
      status: 'active',
      account_mode: 'personal',
      display_name_override: '',
    });
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setStatus('');

    const { farmId } = await fetchActiveFarmContext(session.user.id);
    if (!farmId) {
      setError('No farm assigned to your profile.');
      setLoading(false);
      return;
    }
    setActiveFarmId(farmId);

    const [{ data: rolesData, error: rolesErr }, { data: membershipData, error: membersErr }] =
      await Promise.all([
        supabase.from('roles').select('id, key, name').order('name'),
        supabase
          .from('farm_memberships')
          .select(
            'id, farm_id, auth_user_id, role_id, status, account_mode, person_id, display_name_override, created_at, last_seen_at',
          )
          .eq('farm_id', farmId)
          .order('created_at', { ascending: true }),
      ]);

    if (rolesErr) {
      setError(rolesErr.message);
      setLoading(false);
      return;
    }
    if (membersErr) {
      setError(membersErr.message);
      setLoading(false);
      return;
    }

    const authIds = Array.from(
      new Set((membershipData ?? []).map((row) => row.auth_user_id)),
    );
    const { data: profilesData } = authIds.length
      ? await supabase
          .from('user_profiles')
          .select('auth_user_id, display_name')
          .in('auth_user_id', authIds)
      : { data: [] as Profile[] };

    const map: Record<string, string> = {};
    (profilesData ?? []).forEach((profile) => {
      if (profile.display_name) {
        map[profile.auth_user_id] = profile.display_name;
      }
    });

    const nextDefaultRoleId =
      rolesData?.find((role) => role.key === 'user')?.id ??
      rolesData?.[0]?.id ??
      '';
    setRoles(rolesData ?? []);
    setMemberships((membershipData as Membership[]) ?? []);
    setProfileMap(map);
    setForm((prev) => ({
      ...prev,
      role_id: prev.role_id || nextDefaultRoleId,
    }));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFarmId) {
      setError('No farm assigned to your profile.');
      return;
    }
    if (!form.auth_user_id.trim()) {
      setError('Auth user ID is required.');
      return;
    }
    if (!form.role_id) {
      setError('Select a role.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus('');

    const payload = {
      id: form.id,
      farm_id: activeFarmId,
      auth_user_id: form.auth_user_id.trim(),
      role_id: form.role_id,
      status: form.status,
      account_mode: form.account_mode,
      display_name_override: form.display_name_override || null,
    };

    const result = form.id
      ? await supabase.from('farm_memberships').update(payload).eq('id', form.id)
      : await supabase
          .from('farm_memberships')
          .insert({ ...payload, created_by_auth_user_id: session.user.id });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setStatus('User saved.');
    setSaving(false);
    resetForm();
    loadData();
  };

  const handleDelete = async (membership: Membership) => {
    const confirmed = window.confirm(
      `Remove ${displayName(membership)} from this farm?`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    setStatus('');

    const { error: deleteError } = await supabase
      .from('farm_memberships')
      .delete()
      .eq('id', membership.id);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }
    setStatus('User removed.');
    setDeleting(false);
    resetForm();
    loadData();
  };

  const openEdit = (membership: Membership) => {
    setForm({
      id: membership.id,
      auth_user_id: membership.auth_user_id,
      role_id: membership.role_id,
      status: membership.status,
      account_mode: membership.account_mode,
      display_name_override: membership.display_name_override ?? '',
    });
    setStatus('');
    setError(null);
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Manage Users" />
      <div className="app">
        <div className="card stack">
          <h1>Manage Users</h1>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="stack">
              <h2>Add / Edit User</h2>
              <form className="stack" onSubmit={handleSave}>
                <label className="stack">
                  <span>Auth user ID</span>
                  <input
                    type="text"
                    value={form.auth_user_id}
                    onChange={(e) =>
                      setForm({ ...form, auth_user_id: e.target.value })
                    }
                    placeholder="Supabase auth user id"
                    required
                  />
                </label>
                <label className="stack">
                  <span>Display name override</span>
                  <input
                    type="text"
                    value={form.display_name_override}
                    onChange={(e) =>
                      setForm({ ...form, display_name_override: e.target.value })
                    }
                    placeholder="Optional display name override"
                  />
                </label>
                <label className="stack">
                  <span>Role</span>
                  <select
                    value={form.role_id}
                    onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stack">
                  <span>Account mode</span>
                  <select
                    value={form.account_mode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        account_mode: e.target.value as MembershipForm['account_mode'],
                      })
                    }
                  >
                    <option value="personal">Personal</option>
                    <option value="shared">Shared</option>
                  </select>
                </label>
                <label className="stack">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as MembershipForm['status'],
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save user'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="secondary"
                  >
                    Clear
                  </button>
                </div>
                {status && <p className="status">{status}</p>}
                {error && <p className="status">{error}</p>}
              </form>

              <h2>All Users</h2>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Auth user ID</th>
                      <th>Role</th>
                      <th>Account mode</th>
                      <th>Status</th>
                      <th>Last seen</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.map((membership) => (
                      <tr key={membership.id}>
                        <td>{displayName(membership)}</td>
                        <td>{membership.auth_user_id}</td>
                        <td>{roleMap[membership.role_id]?.name ?? '-'}</td>
                        <td>{membership.account_mode}</td>
                        <td>{membership.status}</td>
                        <td>
                          {membership.last_seen_at
                            ? new Date(membership.last_seen_at).toLocaleString()
                            : '-'}
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={() => openEdit(membership)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(membership)}
                            disabled={deleting}
                            style={{ background: '#fdd', color: '#900' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ManageUsers;
