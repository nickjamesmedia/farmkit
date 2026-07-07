import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import ModalX from '../components/ModalX';
import { toSlug, equipmentSlug } from '../utils/slug';

type Props = {
  session: Session;
};

type Equipment = {
  id: string;
  nickname: string | null;
  category: string | null;
  make: string | null;
  model: string | null;
  unit_number: string | null;
  vin_sn: string | null;
  year: number | null;
  year_of_purchase: number | null;
  license_class: string | null;
  next_service_at: string | null;
  cvip_expires_at: string | null;
  insurance_expires_at: string | null;
  oil_filter_number: string | null;
  fuel_filter_number: string | null;
  air_filter_number: string | null;
  farm?: { name: string | null; slug: string | null } | null;
  home_container?: { name: string | null; code: string | null } | null;
  current_container?: { name: string | null; code: string | null } | null;
};

type MaintenanceLog = {
  id: string;
  title: string;
  status: string | null;
  maintenance_date: string | null;
  logged_at: string;
  description: string | null;
};

function EquipmentDetail({ session }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Equipment>>({});
  const navigate = useNavigate();
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading, roleKey } = useNavData();
  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const canManageEquipment = roleKey === 'admin' || roleKey === 'manager';

  const decoded = useMemo(() => decodeURIComponent(slug ?? ''), [slug]);
  const normalizedName = useMemo(
    () => decoded.replace(/-/g, ' ').trim(),
    [decoded],
  );
  const targetSlug = useMemo(() => toSlug(decoded), [decoded]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      let found: Equipment | null = null;
      if (navLoading) return;
      if (!activeFarmId) {
        setError('No farm assigned to your profile.');
        setLoading(false);
        return;
      }
      if (!equipmentEnabled) {
        setError('Equipment module is disabled for this farm.');
        setLoading(false);
        return;
      }
      const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId];

      const selectClause =
        '*, farm:farm_id(name, slug), home_container:home_container_id(name, code), current_container:current_container_id(name, code)';

      // Broad candidate search: nickname variants + id match
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const orFilters = [
        `nickname.ilike.%${normalizedName}%`,
        `nickname.ilike.%${decoded}%`,
        `nickname.eq.${normalizedName}`,
        `nickname.eq.${decoded}`,
      ];
      if (uuidRegex.test(decoded)) {
        orFilters.push(`id.eq.${decoded}`);
      }

      let candidateQuery = supabase
        .from('equipment')
        .select(selectClause)
        .or(orFilters.join(','))
        .limit(30);
      candidateQuery = candidateQuery.in('farm_id', farmScope);
      const { data: candidates, error: candErr } = await candidateQuery;
      if (candErr) {
        setError(candErr.message);
        setLoading(false);
        return;
      }

      if (candidates && candidates.length > 0) {
        found =
          candidates.find((row) => equipmentSlug(row) === targetSlug) ??
          candidates.find((row) => toSlug(row.nickname) === targetSlug) ??
          candidates.find((row) => row.nickname?.toLowerCase() === normalizedName.toLowerCase()) ??
          candidates[0];
      }

      // Try by UUID id if still not found
      if (!found && uuidRegex.test(decoded)) {
        let byIdQuery = supabase
          .from('equipment')
          .select(selectClause)
          .eq('id', decoded);
        byIdQuery = byIdQuery.in('farm_id', farmScope);
        const { data: byId } = await byIdQuery.maybeSingle();
        if (byId) {
          found = byId;
        }
      }

      // Final fallback: grab a wider set and match by computed slug
      if (!found) {
        let broadQuery = supabase
          .from('equipment')
          .select(selectClause)
          .limit(500);
        broadQuery = broadQuery.in('farm_id', farmScope);
        const { data: broad } = await broadQuery;
        if (broad && broad.length > 0) {
          found =
            broad.find((row) => equipmentSlug(row) === targetSlug) ??
            broad.find((row) => toSlug(row.nickname) === targetSlug) ??
            null;
        }
      }

      if (!active) return;
      if (!found) {
        setError('Equipment not found');
        setEquipment(null);
        setLogs([]);
        setLoading(false);
        return;
      }
      setEquipment(found as Equipment);

      if (maintenanceEnabled) {
        const { data: logRows, error: logErr } = await supabase
          .from('maintenance_logs')
          .select('id, title, status, maintenance_date, logged_at, description')
          .eq('equipment_id', found.id)
          .in('farm_id', farmScope)
          .order('maintenance_date', { ascending: false })
          .order('logged_at', { ascending: false });

        if (logErr) {
          setError(logErr.message);
          setLogs([]);
        } else {
          setLogs(logRows ?? []);
        }
      } else {
        setLogs([]);
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [decoded, activeFarmId, dataScopeFarmIds, equipmentEnabled, maintenanceEnabled, navLoading]);

  const handleLogEdit = (log: MaintenanceLog) => {
    navigate(`/maintenance/log/${log.id}`);
  };

  const handleLogDelete = async (log: MaintenanceLog) => {
    const confirmed = window.confirm(`Delete "${log.title}"?`);
    if (!confirmed) return;
    const { error: deleteErr } = await supabase
      .from('maintenance_logs')
      .delete()
      .eq('id', log.id);
    if (deleteErr) {
      window.alert(deleteErr.message);
      return;
    }
    setLogs((prev) => prev.filter((row) => row.id !== log.id));
  };

  if (loading) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Equipment Detail" />
        <div className="app">
          <div className="card">Loading...</div>
        </div>
      </>
    );
  }

  if (error || !equipment) {
    return (
      <>
        <Nav session={session} email={session.user.email} pageTitle="Equipment Detail" />
        <div className="app">
          <div className="card">
            <p className="status">{error ?? 'Equipment not found'}</p>
            <Link to="/equipment">Back to Equipment</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Equipment Detail" />
      <div className="app">
        <div className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1>{equipment.nickname ?? 'Equipment'}</h1>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canManageEquipment && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setForm(equipment);
                  }}
                >
                  Edit Equipment
                </button>
              )}
              {maintenanceEnabled && (
                <Link className="nav-btn" to={`/maintenance/add?equipment_id=${equipment.id}`}>
                  Log Maintenance
                </Link>
              )}
              <Link className="nav-btn" to="/equipment">
                Back to list
              </Link>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div><strong>Category:</strong> {equipment.category ?? '-'}</div>
            <div><strong>Make:</strong> {equipment.make ?? '-'}</div>
            <div><strong>Model:</strong> {equipment.model ?? '-'}</div>
            <div><strong>Unit #:</strong> {equipment.unit_number ?? '-'}</div>
            <div><strong>VIN/SN:</strong> {equipment.vin_sn ?? '-'}</div>
            <div><strong>Year:</strong> {equipment.year ?? equipment.year_of_purchase ?? '-'}</div>
            <div><strong>License class:</strong> {equipment.license_class ?? '-'}</div>
            <div><strong>Next service:</strong> {equipment.next_service_at ?? '-'}</div>
            <div><strong>CVIP expires:</strong> {equipment.cvip_expires_at ?? '-'}</div>
            <div><strong>Insurance expires:</strong> {equipment.insurance_expires_at ?? '-'}</div>
            <div><strong>Oil filter:</strong> {equipment.oil_filter_number ?? '-'}</div>
            <div><strong>Fuel filter:</strong> {equipment.fuel_filter_number ?? '-'}</div>
            <div><strong>Air filter:</strong> {equipment.air_filter_number ?? '-'}</div>
            <div>
              <strong>Sub-farm:</strong>{' '}
              {equipment.farm?.name ? (
                <Link
                  to={`/sub-farms/${toSlug(
                    equipment.farm.slug ?? equipment.farm.name ?? '',
                  )}`}
                >
                  {equipment.farm.name}
                </Link>
              ) : (
                '-'
              )}
            </div>
            <div>
              <strong>Home building:</strong>{' '}
              {equipment.home_container?.name ? (
                <Link to={`/buildings/${toSlug(equipment.home_container.name)}`}>
                  {equipment.home_container.name}
                </Link>
              ) : (
                '-'
              )}
            </div>
            <div>
              <strong>Current building:</strong>{' '}
              {equipment.current_container?.name ? (
                <Link to={`/buildings/${toSlug(equipment.current_container.name)}`}>
                  {equipment.current_container.name}
                </Link>
              ) : (
                '-'
              )}
            </div>
          </div>
        </div>

        <div className="card stack">
          <h2>Maintenance Logs</h2>
          {logs.length === 0 && <p>No maintenance logs yet.</p>}
          {logs.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Logged at</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.maintenance_date ?? '-'}</td>
                    <td>{log.title}</td>
                    <td>{log.status ?? '-'}</td>
                    <td>{log.logged_at}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleLogEdit(log)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleLogDelete(log)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(520px, 100%)' }}
          >
            <ModalX onClose={() => setEditing(false)} />
            <h2>Edit Equipment</h2>
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!equipment) return;
                const payload = {
                  nickname: form.nickname ?? equipment.nickname,
                  category: form.category ?? equipment.category,
                  make: form.make ?? equipment.make,
                  model: form.model ?? equipment.model,
                  unit_number: form.unit_number ?? equipment.unit_number,
                  vin_sn: form.vin_sn ?? equipment.vin_sn,
                  year: form.year ?? equipment.year,
                  year_of_purchase: form.year_of_purchase ?? equipment.year_of_purchase,
                  license_class: form.license_class ?? equipment.license_class,
                  next_service_at: form.next_service_at ?? equipment.next_service_at,
                  cvip_expires_at: form.cvip_expires_at ?? equipment.cvip_expires_at,
                  insurance_expires_at: form.insurance_expires_at ?? equipment.insurance_expires_at,
                  oil_filter_number: form.oil_filter_number ?? equipment.oil_filter_number,
                  fuel_filter_number: form.fuel_filter_number ?? equipment.fuel_filter_number,
                  air_filter_number: form.air_filter_number ?? equipment.air_filter_number,
                };
                const { error: updateErr } = await supabase
                  .from('equipment')
                  .update(payload)
                  .eq('id', equipment.id);
                if (!updateErr) {
                  setEquipment({ ...equipment, ...payload });
                  setEditing(false);
                }
              }}
            >
              <label className="stack">
                <span>Nickname</span>
                <input
                  type="text"
                  value={form.nickname ?? equipment.nickname ?? ''}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  required
                />
              </label>
              <label className="stack">
                <span>Category</span>
                <input
                  type="text"
                  value={form.category ?? equipment.category ?? ''}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </label>
              <label className="stack">
                <span>Make</span>
                <input
                  type="text"
                  value={form.make ?? equipment.make ?? ''}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                />
              </label>
              <label className="stack">
                <span>Model</span>
                <input
                  type="text"
                  value={form.model ?? equipment.model ?? ''}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </label>
              <label className="stack">
                <span>Unit #</span>
                <input
                  type="text"
                  value={form.unit_number ?? equipment.unit_number ?? ''}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                />
              </label>
              <label className="stack">
                <span>VIN/SN</span>
                <input
                  type="text"
                  value={form.vin_sn ?? equipment.vin_sn ?? ''}
                  onChange={(e) => setForm({ ...form, vin_sn: e.target.value })}
                />
              </label>
              <label className="stack">
                <span>Year</span>
                <input
                  type="number"
                  value={
                    form.year !== undefined && form.year !== null
                      ? form.year
                      : equipment.year ?? ''
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      year: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="stack">
                <span>Year of purchase</span>
                <input
                  type="number"
                  value={
                    form.year_of_purchase !== undefined && form.year_of_purchase !== null
                      ? form.year_of_purchase
                      : equipment.year_of_purchase ?? ''
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      year_of_purchase:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="stack">
                <span>License class</span>
                <input
                  type="text"
                  value={form.license_class ?? equipment.license_class ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, license_class: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Next service</span>
                <input
                  type="date"
                  value={
                    (form.next_service_at as string) ??
                    (equipment.next_service_at as string) ??
                    ''
                  }
                  onChange={(e) =>
                    setForm({ ...form, next_service_at: e.target.value || null })
                  }
                />
              </label>
              <label className="stack">
                <span>CVIP expires</span>
                <input
                  type="date"
                  value={
                    (form.cvip_expires_at as string) ??
                    (equipment.cvip_expires_at as string) ??
                    ''
                  }
                  onChange={(e) =>
                    setForm({ ...form, cvip_expires_at: e.target.value || null })
                  }
                />
              </label>
              <label className="stack">
                <span>Insurance expires</span>
                <input
                  type="date"
                  value={
                    (form.insurance_expires_at as string) ??
                    (equipment.insurance_expires_at as string) ??
                    ''
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      insurance_expires_at: e.target.value || null,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span>Oil filter #</span>
                <input
                  type="text"
                  value={form.oil_filter_number ?? equipment.oil_filter_number ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, oil_filter_number: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Fuel filter #</span>
                <input
                  type="text"
                  value={form.fuel_filter_number ?? equipment.fuel_filter_number ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, fuel_filter_number: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Air filter #</span>
                <input
                  type="text"
                  value={form.air_filter_number ?? equipment.air_filter_number ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, air_filter_number: e.target.value })
                  }
                />
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit">Save</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default EquipmentDetail;
