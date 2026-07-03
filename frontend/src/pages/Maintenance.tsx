import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type MaintenanceLogRow = {
  id: string;
  title: string;
  status: string | null;
  maintenance_date: string | null;
  logged_at: string;
  person: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  } | null;
  equipment: {
    nickname: string | null;
    unit_number: string | null;
  } | null;
  container: {
    name: string | null;
    code: string | null;
  } | null;
};

const PAGE_SIZE = 20;

function Maintenance({ session }: Props) {
  const [logs, setLogs] = useState<MaintenanceLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;

  const loadLogs = async (nextOffset: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : activeFarmId ? [activeFarmId] : [];
    let query = supabase
      .from('maintenance_logs')
      .select(
        'id, title, status, maintenance_date, logged_at, person:entered_by_person_id(first_name, last_name, display_name), equipment:equipment_id(nickname, unit_number), container:container_id(name, code)',
      )
      .order('logged_at', { ascending: false })
      .range(nextOffset, nextOffset + PAGE_SIZE - 1);
    if (farmScope.length) {
      query = query.in('farm_id', farmScope);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      if (!append) {
        setLogs([]);
        setOffset(0);
      }
      setHasMore(false);
    } else {
      const rows =
        data?.map((row: any) => ({
          ...row,
          equipment: Array.isArray(row.equipment) ? row.equipment[0] ?? null : row.equipment,
          container: Array.isArray(row.container) ? row.container[0] ?? null : row.container,
          person: Array.isArray(row.person) ? row.person[0] ?? null : row.person,
        })) ?? [];
      if (append) {
        setLogs((prev) => [...prev, ...(rows as MaintenanceLogRow[])]);
      } else {
        setLogs(rows as MaintenanceLogRow[]);
      }
      setOffset(nextOffset + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (navLoading) return;
    if (!activeFarmId) {
      setError('No farm assigned to your profile.');
      setLogs([]);
      setLoading(false);
      return;
    }
    if (!maintenanceEnabled) {
      setLogs([]);
      setError(null);
      setLoading(false);
      return;
    }
    loadLogs(0, false);
  }, [maintenanceEnabled, navLoading, activeFarmId, dataScopeFarmIds]);

  const renderEquipment = (log: MaintenanceLogRow) => {
    if (log.equipment?.unit_number) {
      return `Unit ${log.equipment.unit_number}`;
    }
    return log.equipment?.nickname || log.container?.name || '-';
  };

  const renderPerson = (log: MaintenanceLogRow) => {
    const person = log.person;
    if (!person) return '-';
    if (person.display_name) return person.display_name;
    const parts = [person.first_name, person.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  };

  const handleEdit = (log: MaintenanceLogRow) => {
    navigate(`/maintenance/log/${log.id}`);
  };

  const handleDelete = async (log: MaintenanceLogRow) => {
    const confirmed = window.confirm(`Delete "${log.title}"?`);
    if (!confirmed) return;
    setError(null);
    const { error: deleteErr } = await supabase
      .from('maintenance_logs')
      .delete()
      .eq('id', log.id);
    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    setLogs((prev) => prev.filter((row) => row.id !== log.id));
    setOffset((prev) => Math.max(0, prev - 1));
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Maintenance" />
      <div className="app">
        <div className="card stack">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h1 style={{ margin: 0 }}>Maintenance</h1>
            {maintenanceEnabled && (
              <Link to="/maintenance/add">
                <button type="button">New Log</button>
              </Link>
            )}
          </div>
          {loading && <p>Loading...</p>}
          {error && <p className="status">{error}</p>}
          {!loading && !error && !maintenanceEnabled && !navLoading && (
            <p className="status">Maintenance module is disabled for this farm.</p>
          )}
          {!loading && !error && maintenanceEnabled && logs.length === 0 && (
            <p>No maintenance logs yet.</p>
          )}
          {!loading && !error && logs.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Person</th>
                  <th>Equipment</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.maintenance_date ?? log.logged_at ?? '-'}</td>
                    <td>{renderPerson(log)}</td>
                    <td>{renderEquipment(log)}</td>
                    <td>{log.title}</td>
                    <td>{log.status ?? '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleEdit(log)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(log)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !error && logs.length > 0 && (
            <button
              type="button"
              onClick={() => loadLogs(offset, true)}
              disabled={!hasMore || loadingMore}
            >
              {loadingMore ? 'Loading...' : hasMore ? 'Load more' : 'No more logs'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default Maintenance;
