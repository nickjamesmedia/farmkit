import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';

type Props = { session: Session };

type Activity = {
  id: string;
  title: string;
  logged_at: string;
  description: string | null;
  created_by_auth_user_id: string | null;
  entered_by_person_id: string | null;
  user_name?: string | null;
};

function AdminActivity({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      if (navLoading) {
        setLoading(true);
        return;
      }
      if (!activeFarmId) {
        setError('No farm assigned to your profile.');
        setActivity([]);
        setLoading(false);
        return;
      }
      if (!maintenanceEnabled) {
        setError('Maintenance module is disabled for this farm.');
        setActivity([]);
        setLoading(false);
        return;
      }
      const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId];
      const { data, error: err } = await supabase
        .from('maintenance_logs')
        .select(
          'id, title, logged_at, description, created_by_auth_user_id, entered_by_person_id',
        )
        .in('farm_id', farmScope)
        .order('logged_at', { ascending: false })
        .limit(50);
      if (!active) return;
      if (err) {
        setError(err.message);
        setActivity([]);
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
        setActivity(mapped as Activity[]);
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
                        <td>{row.user_name || '-'}</td>
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
