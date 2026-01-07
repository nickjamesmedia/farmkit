import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
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
  equipment: {
    nickname: string | null;
    unit_number: string | null;
  } | null;
};

function Home({ session }: Props) {
  const [logs, setLogs] = useState<MaintenanceLogRow[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);

  const quickActions = useMemo(() => {
    return [
      { label: 'Log Maintenance', to: '/maintenance/add' },
      { label: 'View Equipment', to: '/equipment' },
      { label: 'Account', to: '/account' },
      { label: 'Manage Users', to: '/users' },
      { label: 'Farm Setup', to: '/farm' },
    ];
  }, []);

  useEffect(() => {
    let active = true;

    const loadLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('id, title, status, maintenance_date, logged_at, equipment:equipment_id(nickname, unit_number)')
        .order('maintenance_date', { ascending: false })
        .order('logged_at', { ascending: false })
        .limit(10);
      if (!active) return;
      if (error) {
        setLogsError(error.message);
        setLogs([]);
      } else {
        const rows =
          data?.map((row: any) => ({
            ...row,
            equipment: Array.isArray(row.equipment) ? row.equipment[0] ?? null : row.equipment,
          })) ?? [];
        setLogs(rows as MaintenanceLogRow[]);
      }
      setLogsLoading(false);
    };

    loadLogs();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Home" />
      <div className="app">
        <div className="card stack">
          <h1>Dashboard</h1>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            {quickActions.map((action) => (
              <Link key={action.label} to={action.to}>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    background: '#f8fafc',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  {action.label}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card stack">
          <h2>Your Maintenance Logs</h2>
          {logsLoading && <p>Loading...</p>}
          {logsError && <p className="status">{logsError}</p>}
          {!logsLoading && !logsError && logs.length === 0 && (
            <p>
              No maintenance logs yet. <Link to="/maintenance/add">Log maintenance</Link>
            </p>
          )}
          {!logsLoading && !logsError && logs.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Equipment</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.maintenance_date ?? '-'}</td>
                    <td>
                      {log.equipment?.unit_number
                        ? `Unit ${log.equipment.unit_number}`
                        : log.equipment?.nickname || '-'}
                    </td>
                    <td>{log.title}</td>
                    <td>{log.status ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default Home;
