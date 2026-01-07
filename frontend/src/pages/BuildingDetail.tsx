import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';
import { toSlug } from '../utils/slug';

type Props = { session: Session };

type Building = {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  description: string | null;
  capacity: string | null;
  year_built: number | null;
  heated: boolean | null;
  has_water: boolean | null;
  has_three_phase_power: boolean | null;
  notes: string | null;
  location?: { name: string | null; code: string | null } | null;
};

function BuildingDetail({ session }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [row, setRow] = useState<Building | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const decoded = useMemo(() => decodeURIComponent(slug ?? ''), [slug]);
  const targetSlug = useMemo(() => toSlug(decoded), [decoded]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: err } = await supabase
        .from('buildings')
        .select('*, location:location_id(name, code)')
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
  }, [targetSlug]);

  if (!row) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Building" />
        <div className="app">
          <div className="card">
            <p className="status">{error || 'Building not found'}</p>
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
              <button type="button" onClick={() => alert('Edit building (admin only)')}>
                Edit
              </button>
              <button type="button" onClick={() => alert('Delete building (admin only)')}>
                Delete
              </button>
              <Link className="nav-btn" to="/buildings">
                Back to Buildings
              </Link>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div><strong>Code:</strong> {row.code || '-'}</div>
            <div><strong>Type:</strong> {row.type || '-'}</div>
            <div>
              <strong>Location:</strong>{' '}
              {row.location?.name ? (
                <Link to={`/locations/${toSlug(row.location.name)}`}>{row.location.name}</Link>
              ) : (
                '-'
              )}
            </div>
            <div><strong>Capacity:</strong> {row.capacity || '-'}</div>
            <div><strong>Year built:</strong> {row.year_built ?? '-'}</div>
            <div><strong>Heated:</strong> {row.heated ? 'Yes' : 'No'}</div>
            <div><strong>Water:</strong> {row.has_water ? 'Yes' : 'No'}</div>
            <div><strong>Three-phase power:</strong> {row.has_three_phase_power ? 'Yes' : 'No'}</div>
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
