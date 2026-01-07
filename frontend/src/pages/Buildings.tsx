import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import { toSlug } from '../utils/slug';

type Building = {
  id: string;
  farm_id: string | null;
  location_id: string | null;
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

type Props = { session: Session };

function Buildings({ session }: Props) {
  const [rows, setRows] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickview, setQuickview] = useState<Building | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('buildings')
        .select('*, location:location_id(name, code)');
      if (!active) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data as Building[]) ?? []);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const renderRow = (b: Building) => (
    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setQuickview(b)}>
      <td>{b.name}</td>
      <td>{b.code ?? '-'}</td>
      <td>{b.type ?? '-'}</td>
      <td>{b.location?.name ?? '-'}</td>
    </tr>
  );

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Buildings" />
      <div className="app">
        <div className="card stack">
          <h1>Buildings</h1>
          {loading && <p>Loading...</p>}
          {error && <p className="status">{error}</p>}
          {!loading && !error && rows.length === 0 && <p>No buildings yet.</p>}
          {!loading && !error && rows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>{rows.map(renderRow)}</tbody>
            </table>
          )}
        </div>
      </div>

      {quickview && (
        <div className="modal-backdrop" onClick={() => setQuickview(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)' }}
          >
            <h2>
              {quickview.name} {quickview.code ? `(${quickview.code})` : ''}
            </h2>
            <div className="stack">
              <div><strong>Type:</strong> {quickview.type || '-'}</div>
              <div>
                <strong>Location:</strong>{' '}
                {quickview.location?.name ? (
                  <Link to={`/locations/${toSlug(quickview.location.name)}`}>
                    {quickview.location.name}
                  </Link>
                ) : (
                  '-'
                )}
              </div>
              <div><strong>Capacity:</strong> {quickview.capacity || '-'}</div>
              <div><strong>Year built:</strong> {quickview.year_built ?? '-'}</div>
              <div><strong>Heated:</strong> {quickview.heated ? 'Yes' : 'No'}</div>
              <div><strong>Water:</strong> {quickview.has_water ? 'Yes' : 'No'}</div>
              <div><strong>Three-phase power:</strong> {quickview.has_three_phase_power ? 'Yes' : 'No'}</div>
              <div><strong>Description:</strong> {quickview.description || '-'}</div>
              <div><strong>Notes:</strong> {quickview.notes || '-'}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => alert('Edit building (admin only)')}>Edit</button>
              <button type="button" onClick={() => alert('Delete building (admin only)')}>Delete</button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/buildings/${toSlug(quickview.name)}`);
                  setQuickview(null);
                }}
              >
                More Info
              </button>
              <button
                type="button"
                style={{ background: '#ccc', color: '#000' }}
                onClick={() => setQuickview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Buildings;
