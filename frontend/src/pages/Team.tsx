import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import ModalX from '../components/ModalX';

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
  entity_type: 'person' | 'company';
  first_name: string | null;
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

type MemberSort = 'name' | 'role' | 'status';
type PersonSort = 'name' | 'type' | 'status';

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

  // invite form
  const [inviteSaving, setInviteSaving] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '',
    displayName: '',
    roleId: '',
    accountMode: 'personal',
  });

  // add person/servicer form
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personKind, setPersonKind] = useState<'person' | 'company'>('person');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);

  // table controls
  const [memberFilter, setMemberFilter] = useState('');
  const [memberSort, setMemberSort] = useState<MemberSort>('name');
  const [personFilter, setPersonFilter] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState<'' | 'person' | 'company'>('');
  const [personSort, setPersonSort] = useState<PersonSort>('name');
  const [showInactivePeople, setShowInactivePeople] = useState(false);

  // edit modals
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [memberDraft, setMemberDraft] = useState<{
    role_id: string;
    status: TeamMember['status'];
    account_mode: TeamMember['account_mode'];
  } | null>(null);
  const [memberSaving, setMemberSaving] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [personDraft, setPersonDraft] = useState<Person | null>(null);
  const [personModalSaving, setPersonModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const defaultRoleId = useMemo(
    () => roles.find((role) => role.key === 'user')?.id ?? roles[0]?.id ?? '',
    [roles],
  );

  const loadData = async () => {
    if (!activeFarmId) return;
    setLoading(true);
    setError(null);

    const [{ data: rolesData, error: rolesError }, { data: peopleData, error: peopleError }] =
      await Promise.all([
        supabase.from('roles').select('id, key, name').order('name'),
        supabase
          .from('people')
          .select('id, entity_type, first_name, last_name, display_name, active, notes')
          .eq('farm_id', activeFarmId)
          .order('display_name', { ascending: true }),
      ]);

    if (rolesError || peopleError) {
      setError(rolesError?.message ?? peopleError?.message ?? 'Unable to load team.');
      setLoading(false);
      return;
    }

    if (isAdmin) {
      const { data: teamData, error: teamError } = await supabase.rpc('farmkit_team_members', {
        target_farm_id: activeFarmId,
      });
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
      roleId: prev.roleId || nextRoles.find((r) => r.key === 'user')?.id || nextRoles[0]?.id || '',
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

  const visibleMembers = useMemo(() => {
    let rows = members;
    if (memberFilter.trim()) {
      const needle = memberFilter.toLowerCase();
      rows = rows.filter((m) =>
        [m.display_name, m.email, m.role_name, m.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (memberSort === 'role') return a.role_name.localeCompare(b.role_name);
      if (memberSort === 'status') return a.status.localeCompare(b.status);
      return memberLabel(a).localeCompare(memberLabel(b));
    });
    return sorted;
  }, [members, memberFilter, memberSort]);

  const visiblePeople = useMemo(() => {
    let rows = people.filter((p) => (showInactivePeople ? true : p.active));
    if (personTypeFilter) {
      rows = rows.filter((p) => p.entity_type === personTypeFilter);
    }
    if (personFilter.trim()) {
      const needle = personFilter.toLowerCase();
      rows = rows.filter((p) =>
        [personLabel(p), p.notes].filter(Boolean).join(' ').toLowerCase().includes(needle),
      );
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (personSort === 'type') return a.entity_type.localeCompare(b.entity_type);
      if (personSort === 'status') return Number(b.active) - Number(a.active);
      return personLabel(a).localeCompare(personLabel(b));
    });
    return sorted;
  }, [people, personFilter, personTypeFilter, personSort, showInactivePeople]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFarmId || !inviteForm.roleId) return;
    setInviteSaving(true);
    setError(null);
    setStatus(null);

    const { data, error: inviteError } = await supabase.functions.invoke('invite-team-member', {
      body: {
        farmId: activeFarmId,
        email: inviteForm.email,
        roleId: inviteForm.roleId,
        accountMode: inviteForm.accountMode,
        displayName: inviteForm.displayName,
      },
    });

    if (inviteError) {
      setError(inviteError.message);
    } else {
      setStatus(typeof data?.message === 'string' ? data.message : 'Invite saved.');
      setInviteForm({ email: '', displayName: '', roleId: defaultRoleId, accountMode: 'personal' });
      setShowInvite(false);
      await loadData();
    }
    setInviteSaving(false);
  };

  const saveMember = async () => {
    if (!editMember || !memberDraft) return;
    setMemberSaving(true);
    setModalError(null);
    const { error: updateError } = await supabase
      .from('farm_memberships')
      .update(memberDraft)
      .eq('id', editMember.membership_id);
    if (updateError) {
      setModalError(updateError.message);
    } else {
      setEditMember(null);
      setStatus('Team member updated.');
      await loadData();
    }
    setMemberSaving(false);
  };

  const removeMember = async () => {
    if (!editMember) return;
    const confirmed = window.confirm(
      `Remove ${memberLabel(editMember)} from this farm? They will lose access immediately.`,
    );
    if (!confirmed) return;
    setMemberSaving(true);
    setModalError(null);
    const { error: deleteError } = await supabase
      .from('farm_memberships')
      .delete()
      .eq('id', editMember.membership_id);
    if (deleteError) {
      setModalError(deleteError.message);
    } else {
      setEditMember(null);
      setStatus('Team member removed.');
      await loadData();
    }
    setMemberSaving(false);
  };

  const handleAddPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFarmId) return;
    const first = firstName.trim();
    const last = lastName.trim();
    const company = companyName.trim();

    if (personKind === 'person' && !first) {
      setPersonError('First name is required.');
      return;
    }
    if (personKind === 'company' && !company) {
      setPersonError('Company name is required.');
      return;
    }

    setPersonSaving(true);
    setPersonError(null);
    const payload =
      personKind === 'company'
        ? {
            farm_id: activeFarmId,
            entity_type: 'company',
            first_name: null,
            last_name: null,
            display_name: company,
            active: true,
          }
        : {
            farm_id: activeFarmId,
            entity_type: 'person',
            first_name: first,
            last_name: last || null,
            display_name: [first, last].filter(Boolean).join(' '),
            active: true,
          };

    const { error: insertError } = await supabase.from('people').insert(payload);
    if (insertError) {
      setPersonError(insertError.message);
    } else {
      setFirstName('');
      setLastName('');
      setCompanyName('');
      setShowAddPerson(false);
      await loadData();
    }
    setPersonSaving(false);
  };

  const savePerson = async () => {
    if (!editPerson || !personDraft) return;
    const isCompany = personDraft.entity_type === 'company';
    if (isCompany && !personDraft.display_name?.trim()) {
      setModalError('Company name is required.');
      return;
    }
    if (!isCompany && !personDraft.first_name?.trim()) {
      setModalError('First name is required.');
      return;
    }
    setPersonModalSaving(true);
    setModalError(null);
    const display = isCompany
      ? personDraft.display_name?.trim()
      : [personDraft.first_name?.trim(), personDraft.last_name?.trim()].filter(Boolean).join(' ');
    const { error: updateError } = await supabase
      .from('people')
      .update({
        entity_type: personDraft.entity_type,
        first_name: isCompany ? null : personDraft.first_name?.trim() || null,
        last_name: isCompany ? null : personDraft.last_name?.trim() || null,
        display_name: display,
        notes: personDraft.notes?.trim() || null,
        active: personDraft.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editPerson.id);
    if (updateError) {
      setModalError(updateError.message);
    } else {
      setEditPerson(null);
      setStatus('Saved.');
      await loadData();
    }
    setPersonModalSaving(false);
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Team" />
      <div className="app">
        {isAdmin && (
          <div className="card stack">
            <div className="page-head">
              <h1>Accounts</h1>
              <button type="button" onClick={() => setShowInvite(true)}>
                + Invite user
              </button>
            </div>
            <p style={{ color: 'var(--muted)' }}>
              Accounts can sign in to Farmkit. Invite someone here when they need to
              use the app themselves — otherwise add them below under People &
              Servicers so work can be recorded in their name.
            </p>

            {status && <p className="status">{status}</p>}
            {error && <p className="status error">{error}</p>}
            {loading && <p className="empty">Loading…</p>}

            {!loading && (
              <>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <input
                    type="search"
                    placeholder="Filter accounts…"
                    aria-label="Filter accounts"
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    style={{ flex: '2 1 200px' }}
                  />
                  <select
                    aria-label="Sort accounts"
                    value={memberSort}
                    onChange={(e) => setMemberSort(e.target.value as MemberSort)}
                    style={{ flex: '1 1 140px', width: 'auto' }}
                  >
                    <option value="name">Sort: Name</option>
                    <option value="role">Sort: Role</option>
                    <option value="status">Sort: Status</option>
                  </select>
                </div>

                {visibleMembers.length === 0 ? (
                  <p className="empty">No accounts match.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMembers.map((member) => (
                          <tr
                            key={member.membership_id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setModalError(null);
                              setEditMember(member);
                              setMemberDraft({
                                role_id: member.role_id,
                                status: member.status,
                                account_mode: member.account_mode,
                              });
                            }}
                          >
                            <td>
                              {memberLabel(member)}
                              {member.account_mode === 'shared' ? ' (shared)' : ''}
                            </td>
                            <td>{member.email ?? '-'}</td>
                            <td>{member.role_name}</td>
                            <td>
                              <span className={`chip ${member.status === 'active' ? '' : 'open'}`}>
                                {member.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="card stack">
          <div className="page-head">
            <h1>People &amp; Servicers</h1>
            {canManagePeople && (
              <button type="button" onClick={() => setShowAddPerson(true)}>
                + Add
              </button>
            )}
          </div>
          <p style={{ color: 'var(--muted)' }}>
            The “Person who did the work” list on maintenance logs. Add farm workers,
            family, or outside shops and mechanics — they don’t need a login, and
            their name stays on the work history.
          </p>
          {!isAdmin && error && <p className="status error">{error}</p>}

          {!loading && (
            <>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <input
                  type="search"
                  placeholder="Filter people & servicers…"
                  aria-label="Filter people and servicers"
                  value={personFilter}
                  onChange={(e) => setPersonFilter(e.target.value)}
                  style={{ flex: '2 1 200px' }}
                />
                <select
                  aria-label="Filter by type"
                  value={personTypeFilter}
                  onChange={(e) =>
                    setPersonTypeFilter(e.target.value as '' | 'person' | 'company')
                  }
                  style={{ flex: '1 1 130px', width: 'auto' }}
                >
                  <option value="">All types</option>
                  <option value="person">People</option>
                  <option value="company">Servicers</option>
                </select>
                <select
                  aria-label="Sort people"
                  value={personSort}
                  onChange={(e) => setPersonSort(e.target.value as PersonSort)}
                  style={{ flex: '1 1 130px', width: 'auto' }}
                >
                  <option value="name">Sort: Name</option>
                  <option value="type">Sort: Type</option>
                  <option value="status">Sort: Status</option>
                </select>
                <label
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '0.4rem',
                    flex: '1 1 150px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showInactivePeople}
                    onChange={(e) => setShowInactivePeople(e.target.checked)}
                    style={{ width: 'auto', minHeight: 0 }}
                  />
                  <span style={{ fontWeight: 400 }}>Show removed</span>
                </label>
              </div>

              {visiblePeople.length === 0 ? (
                <p className="empty">No people or servicers match.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePeople.map((person) => (
                        <tr
                          key={person.id}
                          style={{
                            cursor: canManagePeople ? 'pointer' : 'default',
                            opacity: person.active ? 1 : 0.6,
                          }}
                          onClick={() => {
                            if (!canManagePeople) return;
                            setModalError(null);
                            setEditPerson(person);
                            setPersonDraft({ ...person });
                          }}
                        >
                          <td>{personLabel(person)}</td>
                          <td>{person.entity_type === 'company' ? 'Servicer' : 'Person'}</td>
                          <td>
                            <span className="chip">{person.active ? 'active' : 'removed'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={() => setShowInvite(false)} />
            <form className="stack" onSubmit={handleInvite}>
              <h2>Invite a user</h2>
              <p style={{ color: 'var(--muted)' }}>
                They’ll get an email with a link to set their password.
              </p>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={inviteForm.displayName}
                  onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: e.target.value })}
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
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      accountMode: e.target.value as InviteForm['accountMode'],
                    })
                  }
                >
                  <option value="personal">Personal — one person’s own login</option>
                  <option value="shared">Shared — a common login (e.g. shop tablet)</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={inviteSaving}>
                  {inviteSaving ? 'Sending…' : 'Send invite'}
                </button>
                <button type="button" className="secondary" onClick={() => setShowInvite(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editMember && memberDraft && (
        <div className="modal-backdrop" onClick={() => setEditMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={() => setEditMember(null)} />
            <div className="stack">
              <h2>{memberLabel(editMember)}</h2>
              <p style={{ color: 'var(--muted)' }}>{editMember.email}</p>
              <label>
                <span>Role</span>
                <select
                  value={memberDraft.role_id}
                  onChange={(e) => setMemberDraft({ ...memberDraft, role_id: e.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={memberDraft.status}
                  onChange={(e) =>
                    setMemberDraft({
                      ...memberDraft,
                      status: e.target.value as TeamMember['status'],
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited (hasn’t accepted yet)</option>
                  <option value="disabled">Disabled (blocked from the farm)</option>
                </select>
              </label>
              <label>
                <span>Account mode</span>
                <select
                  value={memberDraft.account_mode}
                  onChange={(e) =>
                    setMemberDraft({
                      ...memberDraft,
                      account_mode: e.target.value as TeamMember['account_mode'],
                    })
                  }
                >
                  <option value="personal">Personal</option>
                  <option value="shared">Shared</option>
                </select>
              </label>
              {modalError && <p className="status error">{modalError}</p>}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={saveMember} disabled={memberSaving}>
                  {memberSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={removeMember}
                  disabled={memberSaving}
                  style={{ marginLeft: 'auto' }}
                >
                  Remove from farm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddPerson && (
        <div className="modal-backdrop" onClick={() => setShowAddPerson(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={() => setShowAddPerson(false)} />
            <form className="stack" onSubmit={handleAddPerson}>
              <h2>Add a person or servicer</h2>
              <label>
                <span>What are you adding?</span>
                <select
                  value={personKind}
                  onChange={(e) => setPersonKind(e.target.value as 'person' | 'company')}
                >
                  <option value="person">A person (worker, family…)</option>
                  <option value="company">A company (repair shop, mechanic…)</option>
                </select>
              </label>
              {personKind === 'person' ? (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ flex: '1 1 150px' }}>
                    <span>First name</span>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </label>
                  <label style={{ flex: '1 1 150px' }}>
                    <span>Last name (optional)</span>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <label>
                  <span>Company name</span>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Summit Motors"
                    required
                  />
                </label>
              )}
              {personError && <p className="status error">{personError}</p>}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={personSaving}>
                  {personSaving ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowAddPerson(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editPerson && personDraft && (
        <div className="modal-backdrop" onClick={() => setEditPerson(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={() => setEditPerson(null)} />
            <div className="stack">
              <h2>{personLabel(editPerson)}</h2>
              <label>
                <span>Type</span>
                <select
                  value={personDraft.entity_type}
                  onChange={(e) =>
                    setPersonDraft({
                      ...personDraft,
                      entity_type: e.target.value as Person['entity_type'],
                    })
                  }
                >
                  <option value="person">Person</option>
                  <option value="company">Servicer / company</option>
                </select>
              </label>
              {personDraft.entity_type === 'person' ? (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ flex: '1 1 150px' }}>
                    <span>First name</span>
                    <input
                      type="text"
                      value={personDraft.first_name ?? ''}
                      onChange={(e) =>
                        setPersonDraft({ ...personDraft, first_name: e.target.value })
                      }
                    />
                  </label>
                  <label style={{ flex: '1 1 150px' }}>
                    <span>Last name</span>
                    <input
                      type="text"
                      value={personDraft.last_name ?? ''}
                      onChange={(e) =>
                        setPersonDraft({ ...personDraft, last_name: e.target.value })
                      }
                    />
                  </label>
                </div>
              ) : (
                <label>
                  <span>Company name</span>
                  <input
                    type="text"
                    value={personDraft.display_name ?? ''}
                    onChange={(e) =>
                      setPersonDraft({ ...personDraft, display_name: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                <span>Notes</span>
                <textarea
                  value={personDraft.notes ?? ''}
                  onChange={(e) => setPersonDraft({ ...personDraft, notes: e.target.value })}
                  rows={3}
                />
              </label>
              {modalError && <p className="status error">{modalError}</p>}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={savePerson} disabled={personModalSaving}>
                  {personModalSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditPerson(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={personDraft.active ? 'danger' : 'secondary'}
                  disabled={personModalSaving}
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    setPersonDraft({ ...personDraft, active: !personDraft.active });
                  }}
                >
                  {personDraft.active ? 'Remove from list' : 'Add back to list'}
                </button>
              </div>
              {!personDraft.active && (
                <p className="row-sub">
                  Removed from the picker after you save — their name stays on past logs.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Team;
