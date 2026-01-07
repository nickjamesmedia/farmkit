import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';

type Props = { session: Session };

function AdminTools({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<
    { id: string; created_by_id: string | null; title: string; logged_at: string; user_name: string | null }[]
  >([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('id, created_by_id, title, logged_at, user:created_by_id(name)')
        .order('logged_at', { ascending: false })
        .limit(10);
      if (!active) return;
      if (error) {
        setActivityError(error.message);
      } else {
        setActivity((data as any[]) ?? []);
      }
      setLoading(false);
    };
    loadActivity();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Admin Tools" />
      <div className="app">
        <div className="card stack">
          <h1>Admin Tools</h1>
          {loading && <p>Loading...</p>}
          {!loading && (
            <div className="stack">
              <p>Quick links for administrators:</p>
              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                }}
              >
                <Link className="nav-btn" to="/users">Manage Users</Link>
                <Link className="nav-btn" to="/farm">Farm Setup</Link>
                <Link className="nav-btn" to="/locations">Locations</Link>
                <Link className="nav-btn" to="/buildings">Buildings</Link>
                <Link className="nav-btn" to="/equipment">Equipment</Link>
                <Link className="nav-btn" to="/maintenance/add">Log Maintenance</Link>
              </div>
              <div className="card stack" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>User Activity</h3>
                  <Link className="nav-btn" to="/admin/activity">
                    View more
                  </Link>
                </div>
                {activityError && <p className="status">{activityError}</p>}
                {!activityError && activity.length === 0 && <p>No recent activity.</p>}
                {!activityError && activity.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Title</th>
                        <th>Logged at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map((row) => (
                        <tr key={row.id}>
                          <td>{(row as any).user?.name || '-'}</td>
                          <td>{row.title}</td>
                          <td>{row.logged_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AdminTools;
