import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Nav from '../components/Nav';
import { toSlug } from '../utils/slug';

type Location = {
  id: string;
  farm_id: string | null;
  name: string;
  code: string | null;
  is_primary: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
  notes: string | null;
};

type Props = {
  session: Session;
};

function Locations({ session }: Props) {
  const [rows, setRows] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickview, setQuickview] = useState<Location | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase.from('locations').select('*');
      if (!active) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data as Location[]) ?? []);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const renderRow = (loc: Location) => {
    const cityProv =
      loc.city && loc.province ? `${loc.city}, ${loc.province}` : loc.city || loc.nearest_town || '-';
    return (
      <tr key={loc.id} style={{ cursor: 'pointer' }} onClick={() => setQuickview(loc)}>
        <td>{loc.name}</td>
        <td>{loc.code ?? '-'}</td>
        <td>{cityProv}</td>
        <td>{loc.is_primary ? <span className="status">Primary</span> : '-'}</td>
      </tr>
    );
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Locations" />
      <div className="app">
        <div className="card stack">
          <h1>Locations</h1>
          {loading && <p>Loading...</p>}
          {error && <p className="status">{error}</p>}
          {!loading && !error && rows.length === 0 && <p>No locations yet.</p>}
          {!loading && !error && rows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>City / Nearest town</th>
                  <th>Primary</th>
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
              <div>
                <strong>Primary:</strong> {quickview.is_primary ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Address:</strong>{' '}
                {[quickview.address_line1, quickview.address_line2]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </div>
              <div>
                <strong>City/Province:</strong>{' '}
                {[quickview.city, quickview.province].filter(Boolean).join(', ') || '-'}
              </div>
              <div>
                <strong>Postal:</strong> {quickview.postal_code || '-'}
              </div>
              <div>
                <strong>Nearest town:</strong> {quickview.nearest_town || '-'}
              </div>
              <div>
                <strong>Nearest hospital:</strong>{' '}
                {quickview.nearest_hospital_name || '-'}{' '}
                {quickview.nearest_hospital_distance_km
                  ? `(${quickview.nearest_hospital_distance_km} km)`
                  : ''}
              </div>
              <div>
                <strong>Emergency instructions:</strong>{' '}
                {quickview.emergency_instructions || '-'}
              </div>
              <div>
                <strong>Notes:</strong> {quickview.notes || '-'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => alert('Edit location (admin only)')}>
                Edit
              </button>
              <button type="button" onClick={() => alert('Delete location (admin only)')}>
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/locations/${toSlug(quickview.name)}`);
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

export default Locations;
