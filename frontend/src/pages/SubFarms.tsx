import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import ModalX from '../components/ModalX';
import { toSlug } from '../utils/slug';

type FarmErp = {
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
  has_fuel_storage: boolean | null;
  has_chemical_storage: boolean | null;
};

type SubFarm = {
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

function SubFarms({ session }: Props) {
  const [rows, setRows] = useState<SubFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickview, setQuickview] = useState<SubFarm | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { moduleEnabledByKey, roleKey } = useNavData();
  const erpEnabled = moduleEnabledByKey.erp ?? true;
  const isAdmin = roleKey === 'admin';

  // the primary (top-level) farm is the only valid parent for a new sub-farm
  const primaryFarm = rows.find((row) => !row.parent_farm_id) ?? null;

  const groupedRows = (() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const childrenByParent = new Map<string, SubFarm[]>();

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

    const flattened: { row: SubFarm; depth: number }[] = [];
    parents.forEach((parent) => {
      flattened.push({ row: parent, depth: 0 });
      const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      children.forEach((child) => flattened.push({ row: child, depth: 1 }));
    });

    return flattened;
  })();

  const loadSubFarms = async () => {
    const { data, error: err } = await supabase
      .from('farms')
      .select(
        'id, name, slug, parent_farm_id, status, farm_details:farm_details(address_line1, address_line2, city, province, postal_code, country, notes), farm_erp:farm_erp(nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions, has_fuel_storage, has_chemical_storage)',
      )
      .order('name', { ascending: true });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setError(null);
      setRows((data as SubFarm[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadSubFarms();
  }, [session.user.id]);

  // Farm Setup links here with ?add=1 to jump straight into the add modal
  useEffect(() => {
    if (searchParams.get('add') === '1' && isAdmin && primaryFarm && !showAdd) {
      setShowAdd(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAdmin, primaryFarm]);

  const handleAddSubFarm = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || !primaryFarm) return;
    setAddSaving(true);
    setAddError(null);
    const { error: err } = await supabase.from('farms').insert({
      name,
      slug: toSlug(name),
      parent_farm_id: primaryFarm.id,
    });
    if (err) {
      setAddError(
        err.message.includes('farms_slug_key')
          ? 'A sub-farm with a very similar name already exists.'
          : err.message,
      );
    } else {
      setNewName('');
      setShowAdd(false);
      await loadSubFarms();
    }
    setAddSaving(false);
  };

  const renderRow = (loc: SubFarm, depth: number) => {
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
      <Nav session={session} email={session.user.email} pageTitle="Sub-farms" />
      <div className="app">
        <div className="card stack">
          <div className="page-head">
            <h1>Sub-farms</h1>
            {isAdmin && primaryFarm && (
              <button type="button" onClick={() => setShowAdd(true)}>
                + Add sub-farm
              </button>
            )}
          </div>
          <p style={{ color: 'var(--muted)' }}>
            Sub-farms are separate farm sites, yards, or properties under your main
            farm, each with its own address. Don’t add buildings here — buildings
            (bins, sheds, shops) live on the Buildings page and belong to a sub-farm.
          </p>
          {loading && <p className="empty">Loading…</p>}
          {error && <p className="status error">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="empty">No sub-farms yet.</p>
          )}
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

      {showAdd && primaryFarm && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ModalX onClose={() => setShowAdd(false)} />
            <form className="stack" onSubmit={handleAddSubFarm}>
              <h2>Add a sub-farm</h2>
              <p style={{ color: 'var(--muted)' }}>
                A sub-farm is a separate yard or site under{' '}
                <strong>{primaryFarm.name}</strong>. Equipment, buildings, and
                logs can be tracked per sub-farm.
              </p>
              <label>
                <span>Sub-farm name</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. North Yard"
                  required
                />
              </label>
              {addError && <p className="status error">{addError}</p>}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={addSaving}>
                  {addSaving ? 'Adding…' : 'Add sub-farm'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quickview && (
        <div className="modal-backdrop" onClick={() => setQuickview(null)}>
        <div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(560px, 100%)' }}
        >
          <ModalX onClose={() => setQuickview(null)} />
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
                <button
                  type="button"
                  onClick={() => {
                  navigate(`/sub-farms/${quickview.slug || toSlug(quickview.name)}`);
                  setQuickview(null);
                }}
              >
                More Info
              </button>
              <button
                type="button"
                className="secondary"
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

export default SubFarms;
