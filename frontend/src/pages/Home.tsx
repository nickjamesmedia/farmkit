import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import QuickLinks from '../components/QuickLinks';

type Props = {
  session: Session;
};

type MaintenanceLogRow = {
  id: string;
  title: string;
  status: string | null;
  maintenance_date: string | null;
  logged_at: string;
  equipment: {
    nickname: string | null;
    unit_number: string | null;
  } | null;
  container: {
    name: string | null;
    code: string | null;
  } | null;
};

function Home({ session }: Props) {
  const [logs, setLogs] = useState<MaintenanceLogRow[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const navigate = useNavigate();
  const { moduleEnabledByKey, loading: navLoading, roleKey } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const handleEdit = (log: MaintenanceLogRow) => {
    navigate(`/maintenance/log/${log.id}`);
  };

  const handleDelete = async (log: MaintenanceLogRow) => {
    const confirmed = window.confirm(`Delete "${log.title}"?`);
    if (!confirmed) return;
    setLogsError(null);
    const { error } = await supabase
      .from('maintenance_logs')
      .delete()
      .eq('id', log.id);
    if (error) {
      setLogsError(error.message);
      return;
    }
    setLogs((prev) => prev.filter((row) => row.id !== log.id));
  };

  const showAdminCard = useMemo(() => roleKey === 'admin', [roleKey]);

  useEffect(() => {
    let active = true;

    const loadLogs = async () => {
      if (navLoading) {
        setLogsLoading(true);
        return;
      }
      if (!maintenanceEnabled) {
        setLogs([]);
        setLogsError(null);
        setLogsLoading(false);
        return;
      }
      setLogsLoading(true);
      setLogsError(null);
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select(
          'id, title, status, maintenance_date, logged_at, equipment:equipment_id(nickname, unit_number), container:container_id(name, code)',
        )
        .eq('created_by_auth_user_id', session.user.id)
        .order('logged_at', { ascending: false })
        .limit(20);
      if (!active) return;
      if (error) {
        setLogsError(error.message);
        setLogs([]);
      } else {
        const rows =
          data?.map((row: any) => ({
            ...row,
            equipment: Array.isArray(row.equipment) ? row.equipment[0] ?? null : row.equipment,
            container: Array.isArray(row.container) ? row.container[0] ?? null : row.container,
          })) ?? [];
        setLogs(rows as MaintenanceLogRow[]);
      }
      setLogsLoading(false);
    };

    loadLogs();
    return () => {
      active = false;
    };
  }, [session.user.id, maintenanceEnabled, navLoading]);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Dashboard" />
      <div className="app">
        <QuickLinks />

        {showAdminCard && !navLoading && (
          <div className="card stack">
            <h2>Admin</h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link className="nav-btn" to="/admin">
                Admin Tools
              </Link>
              <Link className="nav-btn" to="/users">
                Manage Users
              </Link>
              <Link className="nav-btn" to="/admin/farm">
                Farm Setup
              </Link>
            </div>
          </div>
        )}

        <div className="card stack">
          <h2>My Recent Maintenance Logs</h2>
          {logsLoading && <p>Loading...</p>}
          {logsError && <p className="status">{logsError}</p>}
          {!logsLoading && !logsError && !maintenanceEnabled && (
            <p className="status">Maintenance module is disabled for this farm.</p>
          )}
          {!logsLoading && !logsError && logs.length === 0 && (
            <p>
              No maintenance logs yet.{' '}
              {maintenanceEnabled ? (
                <Link to="/maintenance/add">Log maintenance</Link>
              ) : (
                'Maintenance module is disabled.'
              )}
            </p>
          )}
          {!logsLoading && !logsError && logs.length > 0 && (
            <div className="stack">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                  <th>Equipment</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                      <td>{log.maintenance_date ?? '-'}</td>
                      <td>
                        {log.equipment?.unit_number
                          ? `Unit ${log.equipment.unit_number}`
                          : log.equipment?.nickname ||
                            log.container?.name ||
                            '-'}
                    </td>
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
              <Link to="/maintenance">See all maintenance logs</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Home;
