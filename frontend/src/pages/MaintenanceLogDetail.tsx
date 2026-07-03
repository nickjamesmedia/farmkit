import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

type MaintenanceLogRow = {
  id: string;
  farm_id: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed';
  maintenance_date: string | null;
  logged_at: string;
  created_by_auth_user_id: string | null;
  entered_by_person_id: string | null;
  equipment: {
    id: string;
    nickname: string | null;
    unit_number: string | null;
  } | null;
  container: {
    name: string | null;
    code: string | null;
  } | null;
  person: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  } | null;
};

function MaintenanceLogDetail({ session }: Props) {
  const { id } = useParams<{ id: string }>();
  const [log, setLog] = useState<MaintenanceLogRow | null>(null);
  const [peopleOptions, setPeopleOptions] = useState<PersonOption[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [personId, setPersonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const { moduleEnabledByKey, loading: navLoading } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : '-';

  const renderEquipment = (row: MaintenanceLogRow) => {
    if (row.equipment?.unit_number) {
      return `Unit ${row.equipment.unit_number}`;
    }
    return row.equipment?.nickname || row.container?.name || '-';
  };

  const renderPerson = (row: MaintenanceLogRow) => {
    const person = row.person;
    if (!person) return '-';
    if (person.display_name) return person.display_name;
    const parts = [person.first_name, person.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) {
        setError('Maintenance log not found.');
        setLoading(false);
        return;
      }
      if (navLoading) {
        setLoading(true);
        return;
      }
      if (!maintenanceEnabled) {
        setError('Maintenance module is disabled for this farm.');
        setLog(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const { data, error: logErr } = await supabase
        .from('maintenance_logs')
        .select(
          'id, farm_id, title, description, status, maintenance_date, logged_at, created_by_auth_user_id, entered_by_person_id, equipment:equipment_id(id, nickname, unit_number), container:container_id(name, code), person:entered_by_person_id(id, first_name, last_name, display_name)',
        )
        .eq('id', id)
        .maybeSingle();

      if (!active) return;
      if (logErr || !data) {
        setError(logErr?.message ?? 'Maintenance log not found.');
        setLog(null);
        setLoading(false);
        return;
      }

      const row = {
        ...data,
        equipment: Array.isArray(data.equipment) ? data.equipment[0] ?? null : data.equipment,
        container: Array.isArray(data.container) ? data.container[0] ?? null : data.container,
        person: Array.isArray(data.person) ? data.person[0] ?? null : data.person,
      } as MaintenanceLogRow;

      setLog(row);
      setTitle(row.title);
      setDescription(row.description ?? '');
      setStatus(row.status ?? 'open');
      setMaintenanceDate(row.maintenance_date ?? '');
      setPersonId(row.entered_by_person_id ?? '');

      const { data: peopleData, error: peopleErr } = await supabase
        .from('people')
        .select('id, first_name, last_name, display_name')
        .eq('farm_id', row.farm_id)
        .eq('active', true)
        .order('first_name', { ascending: true });

      if (!active) return;
      if (peopleErr) {
        setError(peopleErr.message);
        setPeopleOptions([]);
      } else {
        setPeopleOptions(peopleData ?? []);
      }

      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [id, maintenanceEnabled, navLoading]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!log) return;
    setSaving(true);
    setError(null);
    setStatusMessage('');

    const { error: updateErr } = await supabase
      .from('maintenance_logs')
      .update({
        title: title.trim() || log.title,
        description: description.trim() || null,
        status,
        maintenance_date: maintenanceDate || null,
        entered_by_person_id: personId || null,
        updated_at: new Date().toISOString(),
        updated_by_auth_user_id: session.user.id,
      })
      .eq('id', log.id);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    setStatusMessage('Maintenance log updated.');
    setSaving(false);
  };

  if (loading) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Maintenance Log" />
        <div className="app">
          <div className="card">Loading...</div>
        </div>
      </>
    );
  }

  if (error || !log) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Maintenance Log" />
        <div className="app">
          <div className="card stack">
            <p className="status">{error ?? 'Maintenance log not found.'}</p>
            <Link to="/maintenance">Back to Maintenance</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Maintenance Log" />
      <div className="app">
        <div className="card stack">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h1 style={{ margin: 0 }}>Maintenance Log</h1>
            <Link to="/maintenance">Back to Maintenance</Link>
          </div>

          <div className="stack">
            <div>
              <strong>Equipment:</strong>{' '}
              {log.equipment?.id ? (
                <Link to={`/equipment/${log.equipment.id}`}>{renderEquipment(log)}</Link>
              ) : (
                renderEquipment(log)
              )}
            </div>
            <div>
              <strong>Person:</strong> {renderPerson(log)}
            </div>
            <div>
              <strong>Logged at:</strong> {formatDate(log.logged_at)}
            </div>
            <div>
              <strong>Created by:</strong> {log.created_by_auth_user_id ?? '-'}
            </div>
          </div>

          <form className="stack" onSubmit={handleSave}>
            <label className="stack">
              <span>Maintenance date</span>
              <input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </label>

            <label className="stack">
              <span>Person who did the work</span>
              <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">Select a person</option>
                {peopleOptions.map((person) => {
                  const label =
                    person.display_name ||
                    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
                    'Unnamed';
                  return (
                    <option key={person.id} value={person.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="stack">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'closed')}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label className="stack">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="stack">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>

            {statusMessage && <p className="status">{statusMessage}</p>}
            {error && <p className="status">{error}</p>}
          </form>
        </div>
      </div>
    </>
  );
}

export default MaintenanceLogDetail;
