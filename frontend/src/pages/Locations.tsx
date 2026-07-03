import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import { toSlug } from '../utils/slug';

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
  status: string | null;
  farm_details?: {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
    notes: string | null;
  } | {
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
    notes: string | null;
  }[] | null;
  farm_erp?: FarmErp | FarmErp[] | null;
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
  const { moduleEnabledByKey, roleKey } = useNavData();
  const erpEnabled = moduleEnabledByKey.erp ?? true;
  const isAdmin = roleKey === 'admin';

  const groupedRows = (() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const childrenByParent = new Map<string, Location[]>();

    rows.forEach((row) => {
      if (row.parent_farm_id) {
        const list = childrenByParent.get(row.parent_farm_id) ?? [];
        list.push(row);
        childrenByParent.set(row.parent_farm_id, list);
      }
    });

    const parents = rows.filter(
      (row) => !row.parent_farm_id || !byId.has(row.parent_farm_id),
    );

    parents.sort((a, b) => a.name.localeCompare(b.name));

    const flattened: { row: Location; depth: number }[] = [];
    parents.forEach((parent) => {
      flattened.push({ row: parent, depth: 0 });
      const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      children.forEach((child) => flattened.push({ row: child, depth: 1 }));
    });

    return flattened;
  })();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('farms')
        .select(
          'id, name, slug, parent_farm_id, status, farm_details:farm_details(address_line1, address_line2, city, province, postal_code, country, notes), farm_erp:farm_erp(nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions, has_fuel_storage, has_chemical_storage)',
        )
        .order('name', { ascending: true });
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
  }, [session.user.id]);

  const renderRow = (loc: Location, depth: number) => {
    const details = Array.isArray(loc.farm_details)
      ? loc.farm_details[0]
      : loc.farm_details;
    const erp = Array.isArray(loc.farm_erp) ? loc.farm_erp[0] : loc.farm_erp;
    const cityProv =
      details?.city && details?.province
        ? `${details.city}, ${details.province}`
        : details?.city || (erpEnabled ? erp?.nearest_town : null) || '-';
    const nameStyle = depth > 0 ? { paddingLeft: `${depth * 1.5}rem` } : undefined;
    return (
      <tr key={loc.id} style={{ cursor: 'pointer' }} onClick={() => setQuickview(loc)}>
        <td style={nameStyle}>{loc.name}</td>
        <td>{loc.slug ?? '-'}</td>
        <td>{cityProv}</td>
        <td>{loc.parent_farm_id ? '-' : <span className="status">Primary</span>}</td>
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
              <tbody>{groupedRows.map(({ row, depth }) => renderRow(row, depth))}</tbody>
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
          {(() => {
            const details = Array.isArray(quickview.farm_details)
              ? quickview.farm_details[0]
              : quickview.farm_details;
            const erp = Array.isArray(quickview.farm_erp)
              ? quickview.farm_erp[0]
              : quickview.farm_erp;
            return (
              <>
            <h2>
              {quickview.name} {quickview.slug ? `(${quickview.slug})` : ''}
            </h2>
            <div className="stack">
              <div>
                <strong>Primary:</strong> {quickview.parent_farm_id ? 'No' : 'Yes'}
              </div>
              <div>
                <strong>Address:</strong>{' '}
                {[details?.address_line1, details?.address_line2]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </div>
              <div>
                <strong>City/Province:</strong>{' '}
                {[details?.city, details?.province].filter(Boolean).join(', ') || '-'}
              </div>
              <div>
                <strong>Postal:</strong> {details?.postal_code || '-'}
              </div>
              {erpEnabled ? (
                <>
                  <div>
                    <strong>Nearest town:</strong> {erp?.nearest_town || '-'}
                  </div>
                  <div>
                    <strong>Nearest hospital:</strong>{' '}
                    {erp?.nearest_hospital_name || '-'}{' '}
                    {erp?.nearest_hospital_distance_km
                      ? `(${erp.nearest_hospital_distance_km} km)`
                      : ''}
                  </div>
                  <div>
                    <strong>Emergency instructions:</strong>{' '}
                    {erp?.emergency_instructions || '-'}
                  </div>
                </>
              ) : (
                <div className="status">ERP module is disabled for this farm.</div>
              )}
              <div>
                <strong>Notes:</strong> {details?.notes || '-'}
              </div>
            </div>
              </>
            );
          })()}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
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
                <button
                  type="button"
                  onClick={() => {
                  navigate(`/locations/${quickview.slug || toSlug(quickview.name)}`);
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
