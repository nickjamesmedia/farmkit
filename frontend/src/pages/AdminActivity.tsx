import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';

type Props = { session: Session };

type Activity = {
  id: string;
  title: string;
  logged_at: string;
  description: string | null;
  created_by_id: string | null;
  user?: { name: string | null } | null;
};

function AdminActivity({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      const { data, error: err } = await supabase
        .from('maintenance_logs')
        .select('id, title, logged_at, description, created_by_id, user:created_by_id(name)')
        .order('logged_at', { ascending: false })
        .limit(50);
      if (!active) return;
      if (err) {
        setError(err.message);
        setActivity([]);
      } else {
        const mapped =
          data?.map((row: any) => ({
            ...row,
            user: Array.isArray(row.user) ? row.user[0] ?? null : row.user ?? null,
          })) ?? [];
        setActivity(mapped as Activity[]);
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
      <Nav session={session} email={session.user.email} pageTitle="User Activity" />
      <div className="app">
        <div className="card stack">
          <h1>User Activity</h1>
          {loading && <p>Loading...</p>}
          {!loading && (
            <>
              {error && <p className="status">{error}</p>}
              {!error && activity.length === 0 && <p>No recent activity.</p>}
              {!error && activity.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Logged at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((row) => (
                      <tr key={row.id}>
                        <td>{row.user?.name || '-'}</td>
                        <td>{row.title}</td>
                        <td>{row.description ?? '-'}</td>
                        <td>{row.logged_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default AdminActivity;
