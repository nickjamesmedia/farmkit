import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import { toSlug } from '../utils/slug';

type Equipment = {
  id: string;
  farm_id: string;
  home_container_id: string | null;
  current_container_id: string | null;
  category: string | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
  serial_number: string | null;
  year: number | null;
  unit_number: string | null;
  vin_sn: string | null;
  year_of_purchase: number | null;
  license_class: string | null;
  next_service_at: string | null;
  cvip_expires_at: string | null;
  insurance_expires_at: string | null;
  oil_filter_number: string | null;
  fuel_filter_number: string | null;
  air_filter_number: string | null;
  active: boolean | null;
  notes: string | null;
  farm?: {
    name: string | null;
    slug: string | null;
  } | null;
  home_container?: {
    name: string | null;
    code: string | null;
  } | null;
  current_container?: {
    name: string | null;
    code: string | null;
  } | null;
};

type EquipmentPageProps = {
  session: Session;
};

type MaintenanceLog = {
  id: string;
  equipment_id: string;
  title: string;
  description: string | null;
  status: string | null;
  maintenance_date: string | null;
  logged_at: string;
  hours_on_meter: number | null;
  next_due_at: string | null;
};

function EquipmentPage({ session }: EquipmentPageProps) {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [nickname, setNickname] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [unitNumber, setUnitNumber] = useState('');
  const [vinSn, setVinSn] = useState('');
  const [yearOfPurchase, setYearOfPurchase] = useState<number | ''>('');
  const [licenseClass, setLicenseClass] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [listCategory, setListCategory] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  );
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const {
    activeFarmId: navActiveFarmId,
    dataScopeFarmIds,
    moduleEnabledByKey,
    loading: navLoading,
    roleKey,
  } = useNavData();
  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const canManageEquipment = roleKey === 'admin' || roleKey === 'manager';

  useEffect(() => {
    const fetchEquipment = async () => {
      setLoading(true);
      setError(null);
      if (navLoading) return;
      if (!navActiveFarmId) {
        setError('No farm assigned to your profile.');
        setEquipment([]);
        setCategories([]);
        setLoading(false);
        return;
      }
      if (!equipmentEnabled) {
        setEquipment([]);
        setCategories([]);
        setLoading(false);
        return;
      }
      setActiveFarmId(navActiveFarmId);
      const farmScope = dataScopeFarmIds.length
        ? dataScopeFarmIds
        : [navActiveFarmId];
      const { data, error: err } = await supabase
        .from('equipment')
        .select(
          '*, farm:farm_id(name, slug), home_container:home_container_id(name, code), current_container:current_container_id(name, code)',
        )
        .in('farm_id', farmScope);
      if (err) {
        setError(err.message);
        setEquipment([]);
        setCategories([]);
      } else {
        setEquipment(data ?? []);
        const distinctCategories = Array.from(
          new Set(
            (data ?? [])
              .map((item) => item.category)
              .filter((cat): cat is string => Boolean(cat)),
          ),
        );
        setCategories(distinctCategories);
      }
      setLoading(false);
    };

    fetchEquipment();
  }, [
    session.user.id,
    navActiveFarmId,
    dataScopeFarmIds,
    equipmentEnabled,
    navLoading,
  ]);

  const resetForm = () => {
    setCategory('');
    setMake('');
    setModel('');
    setNickname('');
    setSerialNumber('');
    setYear('');
    setUnitNumber('');
    setVinSn('');
    setYearOfPurchase('');
    setLicenseClass('');
    setFormError(null);
  };

  const refreshList = async () => {
    if (!activeFarmId) return;
    const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId];
    const { data, error: err } = await supabase
      .from('equipment')
      .select(
        '*, farm:farm_id(name, slug), home_container:home_container_id(name, code), current_container:current_container_id(name, code)',
      )
      .in('farm_id', farmScope);
    if (!err) setEquipment(data ?? []);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    if (!activeFarmId) {
      setFormError('No farm assigned to your profile.');
      setSaving(false);
      return;
    }

    const payload = {
      nickname,
      category,
      make,
      model,
      serial_number: serialNumber || null,
      year: year === '' ? null : year,
      unit_number: unitNumber || null,
      vin_sn: vinSn || null,
      year_of_purchase: yearOfPurchase === '' ? null : yearOfPurchase,
      license_class: licenseClass || null,
    };

    let insertError;
    if (editingEquipment) {
      const { error } = await supabase
        .from('equipment')
        .update(payload)
        .eq('id', editingEquipment.id);
      insertError = error ?? null;
    } else {
      const { error } = await supabase
        .from('equipment')
        .insert({ ...payload, farm_id: activeFarmId });
      insertError = error ?? null;
    }

    if (insertError) {
      setFormError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    setEditingEquipment(null);
    resetForm();
    refreshList();
    if (category && !categories.includes(category)) {
      setCategories((prev) => [...prev, category]);
    }
  };

  const openDetails = async (item: Equipment) => {
    setSelectedEquipment(item);
    setShowDetails(true);
    setLogs([]);
    setLogsError(null);
    setLogsLoading(true);
    if (!maintenanceEnabled) {
      setLogs([]);
      setLogsError('Maintenance module is disabled for this farm.');
      setLogsLoading(false);
      return;
    }
    let query = supabase
      .from('maintenance_logs')
      .select('*')
      .eq('equipment_id', item.id)
      .order('maintenance_date', { ascending: false })
      .order('logged_at', { ascending: false })
      .limit(5);
    if (activeFarmId) {
      const farmScope = dataScopeFarmIds.length ? dataScopeFarmIds : [activeFarmId];
      query = query.in('farm_id', farmScope);
    }
    const { data, error: logsErr } = await query;
    if (logsErr) {
      setLogsError(logsErr.message);
      setLogs([]);
    } else {
      setLogs(data ?? []);
    }
    setLogsLoading(false);
  };

  const visibleEquipment = equipment.filter((item) => {
    if (listCategory && item.category !== listCategory) return false;
    if (listSearch.trim()) {
      const needle = listSearch.toLowerCase();
      const haystack = [
        item.nickname,
        item.unit_number,
        item.category,
        item.make,
        item.model,
        item.vin_sn,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Equipment" />
      <div className="app">
        <div className="card stack">
          <div className="page-head">
            <h1>Equipment</h1>
            {equipmentEnabled && canManageEquipment && (
              <button type="button" onClick={() => setShowForm(true)}>
                + Add equipment
              </button>
            )}
          </div>

          {loading && <p className="empty">Loading…</p>}
          {error && <p className="status error">{error}</p>}
          {!loading && !error && !equipmentEnabled && !navLoading && (
            <p className="status">Equipment module is disabled for this farm.</p>
          )}

          {!loading && !error && equipmentEnabled && equipment.length === 0 && (
            <p className="empty">No equipment found.</p>
          )}

          {!loading && !error && equipment.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <input
                type="search"
                placeholder="Search equipment…"
                aria-label="Search equipment"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                style={{ flex: '2 1 220px' }}
              />
              <select
                aria-label="Filter by category"
                value={listCategory}
                onChange={(e) => setListCategory(e.target.value)}
                style={{ flex: '1 1 170px', width: 'auto' }}
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!loading && !error && equipment.length > 0 && visibleEquipment.length === 0 && (
            <p className="empty">No equipment matches those filters.</p>
          )}

          {!loading && !error && visibleEquipment.length > 0 && (
            <div className="table-wrap">
            <table>
              <thead>
                <tr>
          <th>Unit #</th>
          <th>Nickname</th>
          <th>Category</th>
          <th>Make</th>
          <th>Model</th>
          <th>Location</th>
          <th>Building</th>
                </tr>
              </thead>
              <tbody>
        {visibleEquipment.map((item) => (
          <tr
            key={item.id}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              openDetails(item);
            }}
          >
            <td>{item.unit_number ?? '-'}</td>
            <td>{item.nickname ?? '-'}</td>
            <td>{item.category ?? '-'}</td>
            <td>{item.make ?? '-'}</td>
            <td>{item.model ?? '-'}</td>
            <td>{item.farm?.name ?? '-'}</td>
            <td>
              {item.current_container?.name ??
                item.home_container?.name ??
                '-'}
            </td>
          </tr>
        ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div
            className="modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h2>Add Equipment</h2>
            <form className="stack" onSubmit={handleSubmit}>
              <label className="stack">
                <span>Nickname</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </label>
              <label className="stack">
                <span>Category</span>
                <input
                  type="text"
                  list="category-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
                <datalist id="category-options">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </label>
              <label className="stack">
                <span>Make</span>
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                />
              </label>
              <label className="stack">
                <span>Model</span>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </label>
              <label className="stack">
                <span>Serial Number (optional)</span>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </label>
              <label className="stack">
                <span>Unit number (optional)</span>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                />
              </label>
              <label className="stack">
                <span>VIN / SN (optional)</span>
                <input
                  type="text"
                  value={vinSn}
                  onChange={(e) => setVinSn(e.target.value)}
                />
              </label>
              <label className="stack">
                <span>Year (optional)</span>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => {
                    const value = e.target.value;
                    setYear(value === '' ? '' : Number(value));
                  }}
                />
              </label>
              <label className="stack">
                <span>Year of purchase (optional)</span>
                <input
                  type="number"
                  value={yearOfPurchase}
                  onChange={(e) => {
                    const value = e.target.value;
                    setYearOfPurchase(value === '' ? '' : Number(value));
                  }}
                />
              </label>
              <label className="stack">
                <span>License class (optional)</span>
                <input
                  type="text"
                  value={licenseClass}
                  onChange={(e) => setLicenseClass(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingEquipment ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                    setEditingEquipment(null);
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

      {showDetails && selectedEquipment && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowDetails(false);
            setSelectedEquipment(null);
          }}
        >
          <div
            className="modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h2>{selectedEquipment.nickname || 'Equipment details'}</h2>
            <div className="stack">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <strong>Category:</strong> {selectedEquipment.category ?? '-'}
                </div>
                <div>
                  <strong>Make:</strong> {selectedEquipment.make ?? '-'}
                </div>
                <div>
                  <strong>Model:</strong> {selectedEquipment.model ?? '-'}
                </div>
                <div>
                  <strong>Unit #:</strong> {selectedEquipment.unit_number ?? '-'}
                </div>
                <div>
                  <strong>VIN/SN:</strong> {selectedEquipment.vin_sn ?? '-'}
                </div>
                <div>
                  <strong>Year:</strong>{' '}
                  {selectedEquipment.year ?? selectedEquipment.year_of_purchase ?? '-'}
                </div>
                <div>
                  <strong>License class:</strong> {selectedEquipment.license_class ?? '-'}
                </div>
                <div>
                  <strong>Location:</strong>{' '}
                  {selectedEquipment.farm?.name ? (
                    <Link
                      to={`/locations/${toSlug(
                        selectedEquipment.farm.slug ??
                          selectedEquipment.farm.name ??
                          '',
                      )}`}
                    >
                      {selectedEquipment.farm.name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
                <div>
                  <strong>Building:</strong>{' '}
                  {selectedEquipment.current_container?.name ||
                  selectedEquipment.home_container?.name ? (
                    <Link
                      to={`/buildings/${toSlug(
                        selectedEquipment.current_container?.name ??
                          selectedEquipment.home_container?.name ??
                          '',
                      )}`}
                    >
                      {selectedEquipment.current_container?.name ??
                        selectedEquipment.home_container?.name}
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              <div className="stack">
                <h3>Maintenance Logs</h3>
                {logsLoading && <p>Loading logs...</p>}
                {logsError && <p className="status">{logsError}</p>}
                {!logsLoading && !logsError && logs.length === 0 && (
                  <p>
                    No maintenance logs yet.{' '}
                    <a href="/maintenance/add">Log maintenance</a>
                  </p>
                )}
                {!logsLoading && !logsError && logs.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.maintenance_date ?? '-'}</td>
                    <td>{log.title}</td>
                    <td>{log.description ?? '-'}</td>
                    <td>{log.status ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canManageEquipment && (
            <button
              type="button"
              onClick={() => {
                setShowDetails(false);
                setEditingEquipment(selectedEquipment);
                setCategory(selectedEquipment.category ?? '');
                setMake(selectedEquipment.make ?? '');
                setModel(selectedEquipment.model ?? '');
                setNickname(selectedEquipment.nickname ?? '');
                setSerialNumber(selectedEquipment.serial_number ?? '');
                setYear(selectedEquipment.year ?? '');
                setUnitNumber(selectedEquipment.unit_number ?? '');
                setVinSn(selectedEquipment.vin_sn ?? '');
                setYearOfPurchase(selectedEquipment.year_of_purchase ?? '');
                setLicenseClass(selectedEquipment.license_class ?? '');
                setShowForm(true);
              }}
            >
              Edit equipment
            </button>
          )}
          {maintenanceEnabled && (
            <button
              type="button"
              onClick={() => {
                setShowDetails(false);
                navigate(`/maintenance/add?equipment_id=${selectedEquipment.id}`);
              }}
            >
              + Add Log
            </button>
          )}
          <button
            type="button"
            onClick={() => {
                    if (!selectedEquipment) return;
                    const slug = toSlug(selectedEquipment.nickname || selectedEquipment.id);
                    navigate(`/equipment/${slug}`);
                  }}
                >
                  Detailed view
                </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setShowDetails(false);
                    setSelectedEquipment(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EquipmentPage;
