import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type Person = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  active: boolean;
  notes: string | null;
};

function personLabel(p: Person) {
  return (
    p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed'
  );
}

function People({ session }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { activeFarmId, loading: navLoading, roleKey } = useNavData();
  const canManage = roleKey === 'admin' || roleKey === 'manager';

  const loadPeople = async (farmId: string) => {
    const { data, error: err } = await supabase
      .from('people')
      .select('id, first_name, last_name, display_name, active, notes')
      .eq('farm_id', farmId)
      .order('first_name', { ascending: true });
    if (err) {
      setError(err.message);
      setPeople([]);
    } else {
      setError(null);
      setPeople((data as Person[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (navLoading) return;
    if (!activeFarmId) {
      setError('No farm assigned to your profile.');
      setLoading(false);
      return;
    }
    loadPeople(activeFarmId);
  }, [activeFarmId, navLoading]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeFarmId) return;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) {
      setFormError('First name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const display = [first, last].filter(Boolean).join(' ');
    const { error: err } = await supabase.from('people').insert({
      farm_id: activeFarmId,
      first_name: first,
      last_name: last || null,
      display_name: display,
      active: true,
    });
    if (err) {
      setFormError(err.message);
    } else {
      setFirstName('');
      setLastName('');
      await loadPeople(activeFarmId);
    }
    setSaving(false);
  };

  const setActive = async (person: Person, active: boolean) => {
    if (!activeFarmId) return;
    setBusyId(person.id);
    setError(null);
    const { error: err } = await supabase
      .from('people')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', person.id);
    if (err) {
      setError(err.message);
    } else {
      setPeople((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, active } : p)),
      );
    }
    setBusyId(null);
  };

  const activePeople = people.filter((p) => p.active);
  const inactivePeople = people.filter((p) => !p.active);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="People" />
      <div className="app">
        <div className="card stack">
          <div className="page-head">
            <h1>People</h1>
          </div>
          <p style={{ color: 'var(--muted)' }}>
            This is the “Person who did the work” list on maintenance logs. People
            here don’t need their own login — add workers, family, or repair shops
            so work can be recorded under their name.
          </p>

          {canManage && (
            <form
              onSubmit={handleAdd}
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
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </label>
              <label style={{ flex: '1 1 160px' }}>
                <span>Last name (optional)</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? 'Adding…' : '+ Add person'}
              </button>
            </form>
          )}
          {formError && <p className="status error">{formError}</p>}
          {error && <p className="status error">{error}</p>}
          {loading && <p className="empty">Loading…</p>}

          {!loading && !error && activePeople.length === 0 && (
            <p className="empty">No people yet.</p>
          )}
          {!loading && activePeople.length > 0 && (
            <div className="list-rows">
              {activePeople.map((person) => (
                <div key={person.id} className="list-row">
                  <div className="row-main">
                    <div className="row-title">{personLabel(person)}</div>
                    {person.notes && <div className="row-sub">{person.notes}</div>}
                  </div>
                  {canManage && (
                    <div className="row-side">
                      <button
                        type="button"
                        className="secondary small"
                        disabled={busyId === person.id}
                        onClick={() => setActive(person, false)}
                      >
                        Remove from list
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && inactivePeople.length > 0 && (
            <div className="stack" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="secondary small"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowInactive((v) => !v)}
              >
                {showInactive
                  ? 'Hide removed people'
                  : `Show removed people (${inactivePeople.length})`}
              </button>
              {showInactive && (
                <div className="list-rows">
                  {inactivePeople.map((person) => (
                    <div key={person.id} className="list-row">
                      <div className="row-main">
                        <div className="row-title" style={{ color: 'var(--muted)' }}>
                          {personLabel(person)}
                        </div>
                        <div className="row-sub">
                          Removed — their name still shows on past logs.
                        </div>
                      </div>
                      {canManage && (
                        <div className="row-side">
                          <button
                            type="button"
                            className="secondary small"
                            disabled={busyId === person.id}
                            onClick={() => setActive(person, true)}
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
        </div>
      </div>
    </>
  );
}

export default People;
