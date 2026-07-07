import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import ModalX from '../components/ModalX';
import { toSlug } from '../utils/slug';

type Building = {
  id: string;
  farm_id: string;
  parent_id: string | null;
  container_kind: string;
  name: string;
  code: string | null;
  description: string | null;
  notes: string | null;
  active: boolean;
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

type Props = { session: Session };

function Buildings({ session }: Props) {
  const [rows, setRows] = useState<Building[]>([]);
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickview, setQuickview] = useState<Building | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [capacity, setCapacity] = useState('');
  const [yearBuilt, setYearBuilt] = useState<number | ''>('');
  const [heated, setHeated] = useState(false);
  const [hasWater, setHasWater] = useState(false);
  const [hasThreePhasePower, setHasThreePhasePower] = useState(false);

  const navigate = useNavigate();
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading, roleKey } = useNavData();
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);
  const canManage = roleKey === 'admin' || roleKey === 'manager';
  const isAdmin = roleKey === 'admin';

  const resetForm = () => {
    setEditing(null);
    setFormError(null);
    setFarmId(activeFarmId ?? '');
    setName('');
    setCode('');
    setDescription('');
    setNotes('');
    setCapacity('');
    setYearBuilt('');
    setHeated(false);
    setHasWater(false);
    setHasThreePhasePower(false);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (b: Building) => {
    const details = Array.isArray(b.building_details) ? b.building_details[0] : b.building_details;
    setEditing(b);
    setFormError(null);
    setFarmId(b.farm_id);
    setName(b.name ?? '');
    setCode(b.code ?? '');
    setDescription(b.description ?? '');
    setNotes(b.notes ?? '');
    setCapacity(details?.capacity ?? '');
    setYearBuilt(details?.year_built ?? '');
    setHeated(Boolean(details?.heated));
    setHasWater(Boolean(details?.has_water));
    setHasThreePhasePower(Boolean(details?.has_three_phase_power));
    setShowForm(true);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (navLoading) return;
      if (!activeFarmId) {
        setError('No farm assigned to your profile.');
        setRows([]);
        setFarms([]);
        setLoading(false);
        return;
      }
      if (!buildingsEnabled) {
        setRows([]);
        setFarms([]);
        setLoading(false);
        return;
      }
      const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId];
      const [{ data, error: err }, { data: farmRows }] = await Promise.all([
        supabase
          .from('containers')
          .select(
            'id, farm_id, parent_id, container_kind, name, code, description, notes, active, farm:farm_id(name, slug), building_details:building_details(year_built, heated, has_water, has_three_phase_power, capacity)',
          )
          .in('farm_id', farmScope)
          .eq('container_kind', 'building'),
        supabase.from('farms').select('id, name').in('id', farmScope).order('name', { ascending: true }),
      ]);
      if (!active) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data as Building[]) ?? []);
      }

      setFarms(((farmRows as { id: string; name: string }[]) ?? []).filter((f) => f.id && f.name));
      setFarmId((current) => current || activeFarmId);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [activeFarmId, dataScopeFarmIds, buildingsEnabled, navLoading, refreshKey]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!activeFarmId) return;
    if (!buildingsEnabled) return;

    setSaving(true);
    setFormError(null);

    const targetFarmId = farmId || activeFarmId;
    const now = new Date().toISOString();

    try {
      const containerPayload = {
        farm_id: targetFarmId,
        parent_id: null,
        container_kind: 'building',
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        active: true,
        updated_at: now,
      };

      let containerId = editing?.id ?? '';
      if (editing) {
        const { error: updateErr } = await supabase.from('containers').update(containerPayload).eq('id', editing.id);
        if (updateErr) throw updateErr;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('containers')
          .insert(containerPayload)
          .select('id')
          .maybeSingle();
        if (insertErr) throw insertErr;
        if (!inserted?.id) throw new Error('Unable to create building.');
        containerId = inserted.id;
      }

      const detailsPayload = {
        container_id: containerId,
        year_built: yearBuilt === '' ? null : Number(yearBuilt),
        heated,
        has_water: hasWater,
        has_three_phase_power: hasThreePhasePower,
        capacity: capacity.trim() || null,
        updated_at: now,
      };
      const { error: detailsErr } = await supabase
        .from('building_details')
        .upsert(detailsPayload, { onConflict: 'container_id' });
      if (detailsErr) throw detailsErr;

      setShowForm(false);
      resetForm();
      setRefreshKey((v) => v + 1);
    } catch (e: any) {
      setFormError(e?.message ?? 'Unable to save building.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: Building) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(`Delete building "${b.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setError(null);
    const { error: deleteErr } = await supabase.from('containers').delete().eq('id', b.id);
    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    setQuickview(null);
    setRefreshKey((v) => v + 1);
  };

  const renderRow = (b: Building) => {
    const farm = Array.isArray(b.farm) ? b.farm[0] : b.farm;
    return (
      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setQuickview(b)}>
        <td>{b.name}</td>
        <td>{b.code ?? '-'}</td>
        <td>{b.container_kind ?? '-'}</td>
        <td>{farm?.name ?? '-'}</td>
      </tr>
    );
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Buildings" />
      <div className="app">
        <div className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <h1 style={{ margin: 0 }}>Buildings</h1>
            {canManage && buildingsEnabled && !navLoading && (
              <button type="button" onClick={openAdd}>
                + Add Building
              </button>
            )}
          </div>
          <p style={{ color: 'var(--muted)' }}>
            Bins, sheds, shops and other structures — each belongs to a sub-farm,
            and maintenance or inspections can be logged against it.
          </p>
          {loading && <p>Loading...</p>}
          {error && <p className="status">{error}</p>}
          {!loading && !error && !buildingsEnabled && !navLoading && (
            <p className="status">Buildings module is disabled for this farm.</p>
          )}
          {!loading && !error && buildingsEnabled && rows.length === 0 && <p>No buildings yet.</p>}
          {!loading && !error && rows.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Sub-farm</th>
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
            <ModalX onClose={() => setQuickview(null)} />
          <h2>
            {quickview.name} {quickview.code ? `(${quickview.code})` : ''}
          </h2>
            <div className="stack">
              {(() => {
                const details = Array.isArray(quickview.building_details)
                  ? quickview.building_details[0]
                  : quickview.building_details;
                const farm = Array.isArray(quickview.farm) ? quickview.farm[0] : quickview.farm;
                return (
                  <>
              <div><strong>Type:</strong> {quickview.container_kind || '-'}</div>
              <div>
                <strong>Sub-farm:</strong>{' '}
                {farm?.name ? (
                  <Link
                    to={`/sub-farms/${toSlug(
                      farm.slug ?? farm.name ?? '',
                    )}`}
                  >
                    {farm.name}
                  </Link>
                ) : (
                  '-'
                )}
              </div>
              <div><strong>Capacity:</strong> {details?.capacity || '-'}</div>
              <div><strong>Year built:</strong> {details?.year_built ?? '-'}</div>
              <div><strong>Heated:</strong> {details?.heated ? 'Yes' : 'No'}</div>
              <div><strong>Water:</strong> {details?.has_water ? 'Yes' : 'No'}</div>
              <div><strong>Three-phase power:</strong> {details?.has_three_phase_power ? 'Yes' : 'No'}</div>
              <div><strong>Description:</strong> {quickview.description || '-'}</div>
              <div><strong>Notes:</strong> {quickview.notes || '-'}</div>
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  navigate(`/maintenance/add?container_id=${quickview.id}`);
                }}
              >
                + Add Log
              </button>
              {canManage && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    openEdit(quickview);
                    setQuickview(null);
                  }}
                >
                  Edit
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    void handleDelete(quickview);
                  }}
                >
                  Delete
                </button>
              )}
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
                className="secondary"
                onClick={() => setQuickview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (saving) return;
            setShowForm(false);
            resetForm();
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)' }}>
            <ModalX onClose={() => {
            if (saving) return;
            setShowForm(false);
            resetForm();
          }} />
            <h2>{editing ? 'Edit Building' : 'Add Building'}</h2>
            <form className="stack" onSubmit={handleSubmit}>
              {farms.length > 1 && (
                <label className="stack">
                  <span>Sub-farm</span>
                  <select value={farmId} onChange={(e) => setFarmId(e.target.value)} disabled={saving}>
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="stack">
                <span>Name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} />
              </label>

              <label className="stack">
                <span>Code (optional)</span>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} disabled={saving} />
              </label>

              <label className="stack">
                <span>Capacity (optional)</span>
                <input type="text" value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={saving} />
              </label>

              <label className="stack">
                <span>Year built (optional)</span>
                <input
                  type="number"
                  value={yearBuilt}
                  onChange={(e) => {
                    const v = e.target.value;
                    setYearBuilt(v === '' ? '' : Number(v));
                  }}
                  disabled={saving}
                />
              </label>

              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={heated} onChange={(e) => setHeated(e.target.checked)} disabled={saving} />
                <span>Heated</span>
              </label>

              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={hasWater} onChange={(e) => setHasWater(e.target.checked)} disabled={saving} />
                <span>Water</span>
              </label>

              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={hasThreePhasePower}
                  onChange={(e) => setHasThreePhasePower(e.target.checked)}
                  disabled={saving}
                />
                <span>Three-phase power</span>
              </label>

              <label className="stack">
                <span>Description (optional)</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={saving} />
              </label>

              <label className="stack">
                <span>Notes (optional)</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={saving} />
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (saving) return;
                    setShowForm(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
              {formError && <p className="status">{formError}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Buildings;
