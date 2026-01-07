import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';
import { toSlug } from '../utils/slug';

type Props = { session: Session };

type Location = {
  id: string;
  name: string;
  code: string | null;
  is_primary: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  emergency_instructions: string | null;
  has_fuel_storage: boolean;
  has_chemical_storage: boolean;
  notes: string | null;
};

function LocationDetail({ session }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [row, setRow] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const decoded = useMemo(() => decodeURIComponent(slug ?? ''), [slug]);
  const targetSlug = useMemo(() => toSlug(decoded), [decoded]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: err } = await supabase.from('locations').select('*').limit(500);
      if (!active) return;
      if (err) {
        setError(err.message);
        setRow(null);
        return;
      }
      const match = data?.find((d) => toSlug(d.name) === targetSlug) ?? data?.[0] ?? null;
      setRow(match as Location | null);
    };
    load();
    return () => {
      active = false;
    };
  }, [targetSlug]);

  if (!row) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Location" />
        <div className="app">
          <div className="card">
            <p className="status">{error || 'Location not found'}</p>
            <button type="button" onClick={() => navigate('/locations')}>
              Back to Locations
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Location" />
      <div className="app">
        <div className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1>
              {row.name} {row.code ? `(${row.code})` : ''}
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => alert('Edit location (admin only)')}>
                Edit
              </button>
              <button type="button" onClick={() => alert('Delete location (admin only)')}>
                Delete
              </button>
              <Link className="nav-btn" to="/locations">
                Back to Locations
              </Link>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div><strong>Primary:</strong> {row.is_primary ? 'Yes' : 'No'}</div>
            <div><strong>Code:</strong> {row.code || '-'}</div>
            <div><strong>Address:</strong> {[row.address_line1, row.address_line2].filter(Boolean).join(', ') || '-'}</div>
            <div><strong>City:</strong> {row.city || '-'}</div>
            <div><strong>Province:</strong> {row.province || '-'}</div>
            <div><strong>Postal:</strong> {row.postal_code || '-'}</div>
            <div><strong>Country:</strong> {row.country || '-'}</div>
            <div><strong>Nearest town:</strong> {row.nearest_town || '-'}</div>
            <div><strong>Nearest hospital:</strong> {row.nearest_hospital_name || '-'}</div>
            <div><strong>Hospital distance km:</strong> {row.nearest_hospital_distance_km ?? '-'}</div>
            <div><strong>Fuel storage:</strong> {row.has_fuel_storage ? 'Yes' : 'No'}</div>
            <div><strong>Chemical storage:</strong> {row.has_chemical_storage ? 'Yes' : 'No'}</div>
            <div><strong>Primary contact:</strong> {row.primary_contact_name || '-'}</div>
            <div><strong>Contact phone:</strong> {row.primary_contact_phone || '-'}</div>
            <div><strong>Emergency instructions:</strong> {row.emergency_instructions || '-'}</div>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>Notes:</strong> {row.notes || '-'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LocationDetail;
