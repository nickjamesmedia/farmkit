import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import { toSlug } from '../utils/slug';

type Props = { session: Session };

type FarmErp = {
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
  has_fuel_storage: boolean | null;
  has_chemical_storage: boolean | null;
};

type Location = {
  id: string;
  name: string;
  slug: string;
  parent_farm_id: string | null;
  farm_details?: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    primary_contact_name: string | null;
    primary_contact_phone: string | null;
    notes: string | null;
  } | {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    primary_contact_name: string | null;
    primary_contact_phone: string | null;
    notes: string | null;
  }[] | null;
  farm_erp?: FarmErp | FarmErp[] | null;
};

function LocationDetail({ session }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [row, setRow] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { moduleEnabledByKey, roleKey } = useNavData();
  const erpEnabled = moduleEnabledByKey.erp ?? true;
  const isAdmin = roleKey === 'admin';

  const decoded = useMemo(() => decodeURIComponent(slug ?? ''), [slug]);
  const targetSlug = useMemo(() => toSlug(decoded), [decoded]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: err } = await supabase
        .from('farms')
        .select(
          'id, name, slug, parent_farm_id, farm_details:farm_details(address_line1, address_line2, city, province, postal_code, country, latitude, longitude, primary_contact_name, primary_contact_phone, notes), farm_erp:farm_erp(nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions, has_fuel_storage, has_chemical_storage)',
        )
        .limit(500);
      if (!active) return;
      if (err) {
        setError(err.message);
        setRow(null);
        return;
      }
      const match =
          data?.find((d) => d.slug === decoded) ??
        data?.find((d) => toSlug(d.name) === targetSlug) ??
        data?.[0] ??
        null;
      setRow(match as Location | null);
    };
    load();
    return () => {
      active = false;
    };
  }, [targetSlug, decoded]);

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
              {row.name} {row.slug ? `(${row.slug})` : ''}
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isAdmin && (
                <button type="button" onClick={() => alert('Edit location (admin only)')}>
                  Edit
                </button>
              )}
              {isAdmin && (
                <button type="button" onClick={() => alert('Delete location (admin only)')}>
                  Delete
                </button>
              )}
              <Link className="nav-btn" to="/locations">
                Back to Locations
              </Link>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {(() => {
              const details = Array.isArray(row.farm_details)
                ? row.farm_details[0]
                : row.farm_details;
              const erp = Array.isArray(row.farm_erp) ? row.farm_erp[0] : row.farm_erp;
              return (
                <>
                  <div><strong>Primary:</strong> {row.parent_farm_id ? 'No' : 'Yes'}</div>
                  <div><strong>Code:</strong> {row.slug || '-'}</div>
                  <div><strong>Address:</strong> {[details?.address_line1, details?.address_line2].filter(Boolean).join(', ') || '-'}</div>
                  <div><strong>City:</strong> {details?.city || '-'}</div>
                  <div><strong>Province:</strong> {details?.province || '-'}</div>
                  <div><strong>Postal:</strong> {details?.postal_code || '-'}</div>
                  <div><strong>Country:</strong> {details?.country || '-'}</div>
                  <div><strong>Primary contact:</strong> {details?.primary_contact_name || '-'}</div>
                  <div><strong>Contact phone:</strong> {details?.primary_contact_phone || '-'}</div>
                  {erpEnabled ? (
                    <>
                      <div><strong>Nearest town:</strong> {erp?.nearest_town || '-'}</div>
                      <div><strong>Nearest hospital:</strong> {erp?.nearest_hospital_name || '-'}</div>
                      <div><strong>Hospital distance km:</strong> {erp?.nearest_hospital_distance_km ?? '-'}</div>
                      <div><strong>Fuel storage:</strong> {erp?.has_fuel_storage ? 'Yes' : 'No'}</div>
                      <div><strong>Chemical storage:</strong> {erp?.has_chemical_storage ? 'Yes' : 'No'}</div>
                      <div><strong>Emergency instructions:</strong> {erp?.emergency_instructions || '-'}</div>
                    </>
                  ) : (
                    <div className="status" style={{ gridColumn: '1 / -1' }}>
                      ERP module is disabled for this farm.
                    </div>
                  )}
                </>
              );
            })()}
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>Notes:</strong>{' '}
              {(Array.isArray(row.farm_details) ? row.farm_details[0] : row.farm_details)?.notes ||
                '-'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LocationDetail;
