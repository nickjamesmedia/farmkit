import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import { toSlug } from '../utils/slug';

type Props = { session: Session };

type BuildingDetails = {
  year_built: number | null;
  heated: boolean | null;
  has_water: boolean | null;
  has_three_phase_power: boolean | null;
  capacity: string | null;
};

type Building = {
  id: string;
  farm_id: string;
  name: string;
  code: string | null;
  container_kind: string | null;
  description: string | null;
  notes: string | null;
  farm?:
    | { name: string | null; slug: string | null }
    | { name: string | null; slug: string | null }[]
    | null;
  building_details?: BuildingDetails | BuildingDetails[] | null;
};

function BuildingDetail({ session }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('edit') === '1';
  const [row, setRow] = useState<Building | null>(null);
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading, roleKey } = useNavData();
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);
  const canManage = roleKey === 'admin' || roleKey === 'manager';

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
      const [{ data, error: err }, { data: farmRows }] = await Promise.all([
        supabase
          .from('containers')
          .select(
            'id, farm_id, name, code, container_kind, description, notes, farm:farm_id(name, slug), building_details:building_details(year_built, heated, has_water, has_three_phase_power, capacity)',
          )
          .in('farm_id', farmScope)
          .eq('container_kind', 'building')
          .limit(500),
        supabase.from('farms').select('id, name').in('id', farmScope).order('name', { ascending: true }),
      ]);
      if (!active) return;
      if (err) {
        setError(err.message);
        setRow(null);
        return;
      }
      const match = data?.find((d) => toSlug(d.name) === targetSlug) ?? data?.[0] ?? null;
      setRow(match as Building | null);
      setFarms(((farmRows as { id: string; name: string }[]) ?? []).filter((f) => f.id && f.name));
    };
    load();
    return () => {
      active = false;
    };
  }, [targetSlug, activeFarmId, dataScopeFarmIds, buildingsEnabled, navLoading, refreshKey]);

  // Seed the form from the loaded row whenever edit mode is entered.
  useEffect(() => {
    if (!editing || !row) return;
    const details = Array.isArray(row.building_details) ? row.building_details[0] : row.building_details;
    setFormError(null);
    setFarmId(row.farm_id);
    setName(row.name ?? '');
    setCode(row.code ?? '');
    setDescription(row.description ?? '');
    setNotes(row.notes ?? '');
    setCapacity(details?.capacity ?? '');
    setYearBuilt(details?.year_built ?? '');
    setHeated(Boolean(details?.heated));
    setHasWater(Boolean(details?.has_water));
    setHasThreePhasePower(Boolean(details?.has_three_phase_power));
  }, [editing, row]);

  const setEditing = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('edit', '1');
    else next.delete('edit');
    setSearchParams(next, { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!row || !canManage) return;
    setSaving(true);
    setFormError(null);
    const now = new Date().toISOString();
    try {
      const { error: updateErr } = await supabase
        .from('containers')
        .update({
          farm_id: farmId || row.farm_id,
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          updated_at: now,
        })
        .eq('id', row.id);
      if (updateErr) throw updateErr;

      const { error: detailsErr } = await supabase.from('building_details').upsert(
        {
          container_id: row.id,
          year_built: yearBuilt === '' ? null : Number(yearBuilt),
          heated,
          has_water: hasWater,
          has_three_phase_power: hasThreePhasePower,
          capacity: capacity.trim() || null,
          updated_at: now,
        },
        { onConflict: 'container_id' },
      );
      if (detailsErr) throw detailsErr;

      const newSlug = toSlug(name.trim());
      if (newSlug && newSlug !== targetSlug) {
        navigate(`/buildings/${newSlug}`, { replace: true });
      } else {
        setEditing(false);
        setRefreshKey((v) => v + 1);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to save building.');
    } finally {
      setSaving(false);
    }
  };

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

  const farm = Array.isArray(row.farm) ? row.farm[0] : row.farm;
  const details = Array.isArray(row.building_details) ? row.building_details[0] : row.building_details;

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Building" />
      <div className="app">
        <div className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1>
              {row.name} {row.code ? `(${row.code})` : ''}
            </h1>
            {!editing && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {canManage && (
                  <button type="button" onClick={() => setEditing(true)}>
                    Edit Building
                  </button>
                )}
                <Link className="btn" to={`/maintenance/add?container_id=${row.id}`}>
                  + Add Log
                </Link>
                <Link className="nav-btn" to="/buildings">
                  Back to Buildings
                </Link>
              </div>
            )}
          </div>

          {editing && canManage ? (
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
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
              {formError && <p className="status error">{formError}</p>}
            </form>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div><strong>Code:</strong> {row.code || '-'}</div>
              <div><strong>Type:</strong> {row.container_kind || '-'}</div>
              <div>
                <strong>Sub-farm:</strong>{' '}
                {farm?.name ? (
                  <Link to={`/sub-farms/${toSlug(farm.slug ?? farm.name ?? '')}`}>{farm.name}</Link>
                ) : (
                  '-'
                )}
              </div>
              <div><strong>Capacity:</strong> {details?.capacity || '-'}</div>
              <div><strong>Year built:</strong> {details?.year_built ?? '-'}</div>
              <div><strong>Heated:</strong> {details?.heated ? 'Yes' : 'No'}</div>
              <div><strong>Water:</strong> {details?.has_water ? 'Yes' : 'No'}</div>
              <div><strong>Three-phase power:</strong> {details?.has_three_phase_power ? 'Yes' : 'No'}</div>
              <div><strong>Description:</strong> {row.description || '-'}</div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Notes:</strong> {row.notes || '-'}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default BuildingDetail;
