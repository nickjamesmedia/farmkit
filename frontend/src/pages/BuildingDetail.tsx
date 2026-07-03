import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import { toSlug } from '../utils/slug';

type Props = { session: Session };

type Building = {
  id: string;
  name: string;
  code: string | null;
  container_kind: string | null;
  description: string | null;
  notes: string | null;
  farm?:
    | { name: string | null; slug: string | null }
    | { name: string | null; slug: string | null }[]
    | null;
  building_details?: {
    year_built: number | null;
    heated: boolean | null;
    has_water: boolean | null;
    has_three_phase_power: boolean | null;
    capacity: string | null;
  } | { 
    year_built: number | null;
    heated: boolean | null;
    has_water: boolean | null;
    has_three_phase_power: boolean | null;
    capacity: string | null;
  }[] | null;
};

function BuildingDetail({ session }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [row, setRow] = useState<Building | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading, roleKey } = useNavData();
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);
  const canManage = roleKey === 'admin' || roleKey === 'manager';
  const isAdmin = roleKey === 'admin';

  const decoded = useMemo(() => decodeURIComponent(slug ?? ''), [slug]);
  const targetSlug = useMemo(() => toSlug(decoded), [decoded]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (navLoading) return;
      if (!activeFarmId) {
        setError('No farm assigned to your profile.');
        setRow(null);
        return;
      }
      if (!buildingsEnabled) {
        setError(null);
        setRow(null);
        return;
      }
      const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId];
      const { data, error: err } = await supabase
        .from('containers')
        .select(
          'id, name, code, container_kind, description, notes, farm:farm_id(name, slug), building_details:building_details(year_built, heated, has_water, has_three_phase_power, capacity)',
        )
        .in('farm_id', farmScope)
        .eq('container_kind', 'building')
        .limit(500);
      if (!active) return;
      if (err) {
        setError(err.message);
        setRow(null);
        return;
      }
      const match = data?.find((d) => toSlug(d.name) === targetSlug) ?? data?.[0] ?? null;
      setRow(match as Building | null);
    };
    load();
    return () => {
      active = false;
    };
  }, [targetSlug, activeFarmId, dataScopeFarmIds, buildingsEnabled, navLoading]);

  if (!row) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Building" />
        <div className="app">
          <div className="card">
            <p className="status">
              {!navLoading && !buildingsEnabled
                ? 'Buildings module is disabled for this farm.'
                : error || 'Building not found'}
            </p>
            <button type="button" onClick={() => navigate('/buildings')}>
              Back to Buildings
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Building" />
      <div className="app">
        <div className="card stack">
           <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
             <h1>
               {row.name} {row.code ? `(${row.code})` : ''}
             </h1>
             <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canManage && (
                <button type="button" onClick={() => alert('Edit building')}>
                  Edit
                </button>
              )}
              {isAdmin && (
                <button type="button" onClick={() => alert('Delete building')}>
                  Delete
                </button>
              )}
              <Link className="nav-btn" to="/buildings">
                Back to Buildings
              </Link>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div><strong>Code:</strong> {row.code || '-'}</div>
            <div><strong>Type:</strong> {row.container_kind || '-'}</div>
            <div>
              <strong>Location:</strong>{' '}
              {(Array.isArray(row.farm) ? row.farm[0] : row.farm)?.name ? (
                <Link
                  to={`/locations/${toSlug(
                    (Array.isArray(row.farm) ? row.farm[0] : row.farm)?.slug ??
                      (Array.isArray(row.farm) ? row.farm[0] : row.farm)?.name ??
                      '',
                  )}`}
                >
                  {(Array.isArray(row.farm) ? row.farm[0] : row.farm)?.name}
                </Link>
              ) : (
                '-'
              )}
            </div>
            {(() => {
              const details = Array.isArray(row.building_details)
                ? row.building_details[0]
                : row.building_details;
              return (
                <>
                  <div><strong>Capacity:</strong> {details?.capacity || '-'}</div>
                  <div><strong>Year built:</strong> {details?.year_built ?? '-'}</div>
                  <div><strong>Heated:</strong> {details?.heated ? 'Yes' : 'No'}</div>
                  <div><strong>Water:</strong> {details?.has_water ? 'Yes' : 'No'}</div>
                  <div><strong>Three-phase power:</strong> {details?.has_three_phase_power ? 'Yes' : 'No'}</div>
                </>
              );
            })()}
            <div><strong>Description:</strong> {row.description || '-'}</div>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>Notes:</strong> {row.notes || '-'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default BuildingDetail;
