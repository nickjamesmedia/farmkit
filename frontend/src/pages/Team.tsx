import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type Role = {
  id: string;
  key: 'admin' | 'manager' | 'user';
  name: string;
};

type TeamMember = {
  membership_id: string;
  farm_id: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  role_id: string;
  role_key: string;
  role_name: string;
  status: 'active' | 'invited' | 'disabled';
  account_mode: 'personal' | 'shared';
  person_id: string | null;
  display_name_override: string | null;
  inherited_from_farm_id: string | null;
  created_at: string;
  last_seen_at: string | null;
};

type Person = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  active: boolean;
  notes: string | null;
};

type InviteForm = {
  email: string;
  displayName: string;
  roleId: string;
  accountMode: 'personal' | 'shared';
};

function personLabel(person: Person) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    'Unnamed'
  );
}

function memberLabel(member: TeamMember) {
  return member.display_name || member.email || 'Team member';
}

function Team({ session }: Props) {
  const { activeFarmId, loading: navLoading, roleKey } = useNavData();
  const isAdmin = roleKey === 'admin';
  const canManagePeople = roleKey === 'admin' || roleKey === 'manager';

  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [personBusyId, setPersonBusyId] = useState<string | null>(null);
  const [showInactivePeople, setShowInactivePeople] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '',
    displayName: '',
    roleId: '',
    accountMode: 'personal',
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);

  const defaultRoleId = useMemo(() => {
    return roles.find((role) => role.key === 'user')?.id ?? roles[0]?.id ?? '';
  }, [roles]);

  const activePeople = people.filter((person) => person.active);
  const inactivePeople = people.filter((person) => !person.active);

  const loadData = async () => {
    if (!activeFarmId) return;

    setLoading(true);
    setError(null);
    setStatus(null);

    const requests = [
      supabase.from('roles').select('id, key, name').order('name'),
      supabase
        .from('people')
        .select('id, first_name, last_name, display_name, active, notes')
        .eq('farm_id', activeFarmId)
        .order('first_name', { ascending: true }),
    ] as const;

    const [{ data: rolesData, error: rolesError }, { data: peopleData, error: peopleError }] =
      await Promise.all(requests);

    if (rolesError) {
      setError(rolesError.message);
      setLoading(false);
      return;
    }

    if (peopleError) {
      setError(peopleError.message);
      setLoading(false);
      return;
    }

    if (isAdmin) {
      const { data: teamData, error: teamError } = await supabase.rpc(
        'farmkit_team_members',
        { target_farm_id: activeFarmId },
      );

      if (teamError) {
        setError(teamError.message);
        setLoading(false);
        return;
      }

      setMembers((teamData as TeamMember[]) ?? []);
    } else {
      setMembers([]);
    }

    const nextRoles = (rolesData as Role[]) ?? [];
    setRoles(nextRoles);
    setPeople((peopleData as Person[]) ?? []);
    setInviteForm((prev) => ({
      ...prev,
      roleId:
        prev.roleId ||
        nextRoles.find((role) => role.key === 'user')?.id ||
        nextRoles[0]?.id ||
        '',
    }));
    setLoading(false);
  };

  useEffect(() => {
    if (navLoading) return;
    if (!activeFarmId) {
      setError('No farm assigned to your profile.');
      setLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarmId, isAdmin, navLoading]);

  const resetInviteForm = () => {
    setInviteForm({
      email: '',
      displayName: '',
      roleId: defaultRoleId,
      accountMode: 'personal',
    });
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFarmId) return;
    if (!inviteForm.roleId) {
      setError('Select a role.');
      return;
    }

    setInviteSaving(true);
    setError(null);
    setStatus(null);

    const { data, error: inviteError } = await supabase.functions.invoke(
      'invite-team-member',
      {
        body: {
          farmId: activeFarmId,
          email: inviteForm.email,
          roleId: inviteForm.roleId,
          accountMode: inviteForm.accountMode,
          displayName: inviteForm.displayName,
        },
      },
    );

    if (inviteError) {
      setError(inviteError.message);
      setInviteSaving(false);
      return;
    }

    setStatus(
      typeof data?.message === 'string' ? data.message : 'Invite saved.',
    );
    resetInviteForm();
    setInviteSaving(false);
    await loadData();
  };

  const updateMember = async (
    member: TeamMember,
    patch: Partial<Pick<TeamMember, 'role_id' | 'status' | 'account_mode'>>,
  ) => {
    setMemberBusyId(member.membership_id);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from('farm_memberships')
      .update(patch)
      .eq('id', member.membership_id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setStatus('Team member updated.');
      await loadData();
    }
    setMemberBusyId(null);
  };

  const removeMember = async (member: TeamMember) => {
    const confirmed = window.confirm(`Remove ${memberLabel(member)} from this farm?`);
    if (!confirmed) return;

    setMemberBusyId(member.membership_id);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase
      .from('farm_memberships')
      .delete()
      .eq('id', member.membership_id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setStatus('Team member removed.');
      await loadData();
    }
    setMemberBusyId(null);
  };

  const handleAddPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFarmId) return;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) {
      setPersonError('First name is required.');
      return;
    }

    setPersonSaving(true);
    setPersonError(null);

    const display = [first, last].filter(Boolean).join(' ');
    const { error: insertError } = await supabase.from('people').insert({
      farm_id: activeFarmId,
      first_name: first,
      last_name: last || null,
      display_name: display,
      active: true,
    });

    if (insertError) {
      setPersonError(insertError.message);
    } else {
      setFirstName('');
      setLastName('');
      await loadData();
    }
    setPersonSaving(false);
  };

  const setPersonActive = async (person: Person, active: boolean) => {
    setPersonBusyId(person.id);
    setError(null);

    const { error: updateError } = await supabase
      .from('people')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', person.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setPeople((prev) =>
        prev.map((row) => (row.id === person.id ? { ...row, active } : row)),
      );
    }
    setPersonBusyId(null);
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Team" />
      <div className="app">
        <div className="card stack">
          <div className="page-head">
            <h1>Team</h1>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="stack">
              {status && <p className="status">{status}</p>}
              {error && <p className="status error">{error}</p>}

              {isAdmin && (
                <section className="stack">
                  <h2>Account access</h2>
                  <form className="stack" onSubmit={handleInvite}>
                    <div
                      style={{
                        display: 'grid',
                        gap: '0.75rem',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      }}
                    >
                      <label>
                        <span>Email</span>
                        <input
                          type="email"
                          value={inviteForm.email}
                          onChange={(event) =>
                            setInviteForm({ ...inviteForm, email: event.target.value })
                          }
                          autoComplete="email"
                          required
                        />
                      </label>
                      <label>
                        <span>Display name</span>
                        <input
                          type="text"
                          value={inviteForm.displayName}
                          onChange={(event) =>
                            setInviteForm({
                              ...inviteForm,
                              displayName: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Role</span>
                        <select
                          value={inviteForm.roleId}
                          onChange={(event) =>
                            setInviteForm({ ...inviteForm, roleId: event.target.value })
                          }
                          required
                        >
                          <option value="">Select a role</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Account mode</span>
                        <select
                          value={inviteForm.accountMode}
                          onChange={(event) =>
                            setInviteForm({
                              ...inviteForm,
                              accountMode: event.target.value as InviteForm['accountMode'],
                            })
                          }
                        >
                          <option value="personal">Personal</option>
                          <option value="shared">Shared</option>
                        </select>
                      </label>
                    </div>
                    <div>
                      <button type="submit" disabled={inviteSaving}>
                        {inviteSaving ? 'Sending...' : 'Invite user'}
                      </button>
                    </div>
                  </form>

                  {members.length === 0 ? (
                    <p className="empty">No account users yet.</p>
                  ) : (
                    <div className="list-rows">
                      {members.map((member) => (
                        <div key={member.membership_id} className="list-row">
                          <div className="row-main">
                            <div className="row-title">{memberLabel(member)}</div>
                            <div className="row-sub">
                              {[member.email, member.role_name, member.status, member.account_mode]
                                .filter(Boolean)
                                .join(' · ')}
                              {member.inherited_from_farm_id ? ' · inherited' : ''}
                            </div>
                          </div>
                          <div className="row-side" style={{ flexWrap: 'wrap' }}>
                            <select
                              aria-label={`Role for ${memberLabel(member)}`}
                              value={member.role_id}
                              disabled={memberBusyId === member.membership_id}
                              onChange={(event) =>
                                updateMember(member, { role_id: event.target.value })
                              }
                              style={{ minWidth: '120px' }}
                            >
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label={`Status for ${memberLabel(member)}`}
                              value={member.status}
                              disabled={memberBusyId === member.membership_id}
                              onChange={(event) =>
                                updateMember(member, {
                                  status: event.target.value as TeamMember['status'],
                                })
                              }
                              style={{ minWidth: '120px' }}
                            >
                              <option value="active">Active</option>
                              <option value="invited">Invited</option>
                              <option value="disabled">Disabled</option>
                            </select>
                            <button
                              type="button"
                              className="danger small"
                              disabled={memberBusyId === member.membership_id}
                              onClick={() => removeMember(member)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="stack">
                <h2>People</h2>
                {canManagePeople && (
                  <form
                    onSubmit={handleAddPerson}
                    style={{
                      display: 'flex',
                      gap: '0.6rem',
                      flexWrap: 'wrap',
                      alignItems: 'flex-end',
                    }}
                  >
                    <label style={{ flex: '1 1 160px' }}>
                      <span>First name</span>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                      />
                    </label>
                    <label style={{ flex: '1 1 160px' }}>
                      <span>Last name</span>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </label>
                    <button type="submit" disabled={personSaving}>
                      {personSaving ? 'Adding...' : 'Add person'}
                    </button>
                  </form>
                )}
                {personError && <p className="status error">{personError}</p>}

                {activePeople.length === 0 ? (
                  <p className="empty">No people yet.</p>
                ) : (
                  <div className="list-rows">
                    {activePeople.map((person) => (
                      <div key={person.id} className="list-row">
                        <div className="row-main">
                          <div className="row-title">{personLabel(person)}</div>
                          {person.notes && <div className="row-sub">{person.notes}</div>}
                        </div>
                        {canManagePeople && (
                          <div className="row-side">
                            <button
                              type="button"
                              className="secondary small"
                              disabled={personBusyId === person.id}
                              onClick={() => setPersonActive(person, false)}
                            >
                              Remove from list
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {inactivePeople.length > 0 && (
                  <div className="stack">
                    <button
                      type="button"
                      className="secondary small"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setShowInactivePeople((value) => !value)}
                    >
                      {showInactivePeople
                        ? 'Hide removed people'
                        : `Show removed people (${inactivePeople.length})`}
                    </button>
                    {showInactivePeople && (
                      <div className="list-rows">
                        {inactivePeople.map((person) => (
                          <div key={person.id} className="list-row">
                            <div className="row-main">
                              <div
                                className="row-title"
                                style={{ color: 'var(--muted)' }}
                              >
                                {personLabel(person)}
                              </div>
                              <div className="row-sub">
                                Removed; past logs keep this name.
                              </div>
                            </div>
                            {canManagePeople && (
                              <div className="row-side">
                                <button
                                  type="button"
                                  className="secondary small"
                                  disabled={personBusyId === person.id}
                                  onClick={() => setPersonActive(person, true)}
                                >
                                  Add back
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Team;
