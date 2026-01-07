import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type User = {
  id: string;
  auth_user_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  created_at: string;
  last_modified_at: string | null;
  last_modified_by_id: string | null;
};

type UserForm = Partial<User> & {
  email: string;
  role: string;
};

function ManageUsers({ session }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [, setSelectedUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({
    email: '',
    role: 'user',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const displayName = (u: User) =>
    [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || u.email;

  const modifierMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.id] = displayName(u);
    });
    return map;
  }, [users]);

  const resetForm = () => {
    setForm({
      email: '',
      role: 'user',
      auth_user_id: '',
      first_name: '',
      last_name: '',
      name: '',
      id: undefined,
    });
    setSelectedUser(null);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const { data, error: usersErr } = await supabase
      .from('app_users')
      .select(
        'id, auth_user_id, name, first_name, last_name, email, role, created_at, last_modified_at, last_modified_by_id',
      )
      .order('created_at', { ascending: true });
    if (usersErr) {
      setError(usersErr.message);
      setUsers([]);
      setLoading(false);
      return;
    }
    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus('');

    const name =
      (form.name && form.name.trim()) ||
      [form.first_name, form.last_name].filter(Boolean).join(' ').trim() ||
      form.email;

    const payload = {
      id: form.id,
      auth_user_id: form.auth_user_id,
      email: form.email,
      role: form.role ?? 'user',
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      name,
      last_modified_at: new Date().toISOString(),
      last_modified_by_id: users.find((u) => u.auth_user_id === session.user.id)
        ?.id,
    };

    const { error: upsertError } = await supabase
      .from('app_users')
      .upsert(payload, { onConflict: 'id' });
    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }
    setStatus('User saved.');
    setSaving(false);
    resetForm();
    loadData();
  };

  const handleInvite = async (user: User) => {
    const endpoint =
      import.meta.env.VITE_INVITE_ENDPOINT || '/api/send-invite';
    setInviting(true);
    setError(null);
    setStatus('');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          name: user.name,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || response.statusText);
      }
      setStatus(`Invite email sent to ${user.email}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invite failed';
      setError(message);
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(
      `Remove user ${displayName(user)}? Their linked records will stay but user access is removed.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    setStatus('');

    const { error: deleteError } = await supabase
      .from('app_users')
      .delete()
      .eq('id', user.id);
    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }
    setStatus('User deleted.');
    setDeleting(false);
    resetForm();
    loadData();
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setForm({
      ...user,
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
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>
                <label className="stack">
                  <span>Auth user ID</span>
                  <input
                    type="text"
                    value={form.auth_user_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, auth_user_id: e.target.value })
                    }
                    placeholder="Supabase auth user id"
                  />
                </label>
                <label className="stack">
                  <span>First name</span>
                  <input
                    type="text"
                    value={form.first_name ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, first_name: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={form.last_name ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, last_name: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Display name</span>
                  <input
                    type="text"
                    value={form.name ?? ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Optional override"
                  />
                </label>
                <label className="stack">
                  <span>Role</span>
                  <select
                    value={form.role ?? 'user'}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
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
                    style={{ background: '#ccc', color: '#000' }}
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
                      <th>Email</th>
                      <th>Role</th>
                      <th>Last modified</th>
                      <th>Modified by</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{displayName(u)}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td>{u.last_modified_at ? new Date(u.last_modified_at).toLocaleString() : '—'}</td>
                        <td>
                          {u.last_modified_by_id
                            ? modifierMap[u.last_modified_by_id] || '—'
                            : '—'}
                        </td>
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={() => openEdit(u)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={deleting}
                            style={{ background: '#fdd', color: '#900' }}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInvite(u)}
                            disabled={inviting}
                            style={{ background: '#eef', color: '#114' }}
                          >
                            {inviting ? 'Sending...' : 'Send login email'}
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
