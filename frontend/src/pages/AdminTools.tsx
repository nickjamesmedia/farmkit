import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import QuickLinks from '../components/QuickLinks';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';

type Props = { session: Session };

function AdminTools({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<
    { id: string; created_by_auth_user_id: string | null; entered_by_person_id: string | null; title: string; logged_at: string; user_name: string | null }[]
  >([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading, roleKey } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const isAdmin = roleKey === 'admin';

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      if (navLoading) {
        setLoading(true);
        return;
      }
      if (!activeFarmId) {
        setActivityError('No farm assigned to your profile.');
        setLoading(false);
        return;
      }
      if (!maintenanceEnabled) {
        setActivity([]);
        setActivityError(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('id, created_by_auth_user_id, entered_by_person_id, title, logged_at')
        .in('farm_id', dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId])
        .order('logged_at', { ascending: false })
        .limit(10);
      if (!active) return;
      if (error) {
        setActivityError(error.message);
      } else {
        const authIds = Array.from(
          new Set(
            (data ?? [])
              .map((row) => row.created_by_auth_user_id)
              .filter(Boolean),
          ),
        ) as string[];
        const personIds = Array.from(
          new Set(
            (data ?? [])
              .map((row) => row.entered_by_person_id)
              .filter(Boolean),
          ),
        ) as string[];
        const [{ data: profiles }, { data: people }] = await Promise.all([
          authIds.length
            ? supabase
                .from('user_profiles')
                .select('auth_user_id, display_name')
                .in('auth_user_id', authIds)
            : Promise.resolve({ data: [] }),
          personIds.length
            ? supabase
                .from('people')
                .select('id, display_name, first_name, last_name')
                .in('id', personIds)
            : Promise.resolve({ data: [] }),
        ]);
        const profileMap: Record<string, string> = {};
        (profiles ?? []).forEach((profile) => {
          if (profile.display_name) {
            profileMap[profile.auth_user_id] = profile.display_name;
          }
        });
        const personMap: Record<string, string> = {};
        (people ?? []).forEach((person) => {
          const label =
            person.display_name ||
            [person.first_name, person.last_name].filter(Boolean).join(' ') ||
            '';
          if (label) {
            personMap[person.id] = label;
          }
        });
        const mapped =
          data?.map((row) => ({
            ...row,
            user_name:
              personMap[row.entered_by_person_id ?? ''] ||
              profileMap[row.created_by_auth_user_id ?? ''] ||
              null,
          })) ?? [];
        setActivity(mapped);
      }
      setLoading(false);
    };
    loadActivity();
    return () => {
      active = false;
    };
  }, [activeFarmId, dataScopeFarmIds, maintenanceEnabled, navLoading]);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Admin Tools" />
      <div className="app">
        <QuickLinks />
        <div className="card stack">
          <h1>Admin Tools</h1>
          {loading && <p>Loading...</p>}
          {!loading && (
            <div className="stack">
              <p>Admin-only tools:</p>
              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                }}
              >
                <Link className="nav-btn" to="/team">Team</Link>
                {isAdmin && <Link className="nav-btn" to="/admin/farm">Farm Setup</Link>}
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
                          <td>{row.user_name || '-'}</td>
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
