import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  equipment: {
    nickname: string | null;
    unit_number: string | null;
  } | null;
  container: {
    name: string | null;
    code: string | null;
  } | null;
};

type MaintenanceLogQueryRow = Omit<MaintenanceLogRow, 'equipment' | 'container'> & {
  equipment:
    | MaintenanceLogRow['equipment']
    | NonNullable<MaintenanceLogRow['equipment']>[]
    | null;
  container:
    | MaintenanceLogRow['container']
    | NonNullable<MaintenanceLogRow['container']>[]
    | null;
};

function Home({ session }: Props) {
  const [logs, setLogs] = useState<MaintenanceLogRow[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const { moduleEnabledByKey, loading: navLoading, roleKey, displayName } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);

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
        .limit(8);
      if (!active) return;
      if (error) {
        setLogsError(error.message);
        setLogs([]);
      } else {
        const rows =
          (data as MaintenanceLogQueryRow[] | null)?.map((row) => ({
            ...row,
            equipment: Array.isArray(row.equipment) ? row.equipment[0] ?? null : row.equipment,
            container: Array.isArray(row.container) ? row.container[0] ?? null : row.container,
          })) ?? [];
        setLogs(rows);
      }
      setLogsLoading(false);
    };

    loadLogs();
    return () => {
      active = false;
    };
  }, [session.user.id, maintenanceEnabled, navLoading]);

  const logTarget = (log: MaintenanceLogRow) =>
    log.equipment?.nickname ||
    (log.equipment?.unit_number ? `Unit ${log.equipment.unit_number}` : null) ||
    log.container?.name ||
    'Unknown';

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Home" />
      <div className="app">
        <div className="tile-grid">
          {equipmentEnabled && (
            <Link className="tile" to="/equipment">
              <span className="tile-label">Equipment</span>
              <span className="tile-sub">Machines, trucks & units</span>
            </Link>
          )}
          {buildingsEnabled && (
            <Link className="tile" to="/buildings">
              <span className="tile-label">Buildings</span>
              <span className="tile-sub">Bins, sheds & shops</span>
            </Link>
          )}
          {maintenanceEnabled && (
            <Link className="tile" to="/maintenance">
              <span className="tile-label">History</span>
              <span className="tile-sub">All maintenance records</span>
            </Link>
          )}
        </div>

        <div className="card stack">
          <div className="page-head">
            <h2>{displayName ? `${displayName} — recent logs` : 'My recent logs'}</h2>
            {maintenanceEnabled && logs.length > 0 && (
              <Link to="/maintenance" style={{ fontWeight: 600 }}>
                See all →
              </Link>
            )}
          </div>
          {logsLoading && <p className="empty">Loading…</p>}
          {logsError && <p className="status error">{logsError}</p>}
          {!logsLoading && !logsError && !maintenanceEnabled && (
            <p className="status">Maintenance module is disabled for this farm.</p>
          )}
          {!logsLoading && !logsError && maintenanceEnabled && logs.length === 0 && (
            <div className="empty">
              <p>Nothing logged yet.</p>
              <p>
                <Link to="/maintenance/add" style={{ fontWeight: 700 }}>
                  Log your first maintenance job →
                </Link>
              </p>
            </div>
          )}
          {!logsLoading && !logsError && logs.length > 0 && (
            <div className="list-rows">
              {logs.map((log) => (
                <Link
                  key={log.id}
                  className="list-row"
                  to={`/maintenance/log/${log.id}`}
                >
                  <div className="row-main">
                    <div className="row-title">{log.title}</div>
                    <div className="row-sub">
                      {logTarget(log)}
                      {' · '}
                      {log.maintenance_date ?? log.logged_at?.slice(0, 10) ?? ''}
                    </div>
                  </div>
                  <div className="row-side">
                    {log.status && (
                      <span className={`chip ${log.status === 'open' ? 'open' : ''}`}>
                        {log.status}
                      </span>
                    )}
                    <span className="row-chevron">›</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {showAdminCard && !navLoading && (
          <div className="card stack">
            <h2>Admin</h2>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link className="btn secondary" to="/admin">
                Admin Tools
              </Link>
              <Link className="btn secondary" to="/team">
                Team
              </Link>
              <Link className="btn secondary" to="/admin/farm">
                Farm Setup
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Home;
