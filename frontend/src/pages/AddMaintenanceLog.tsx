import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchActiveFarmContext } from '../lib/farmContext';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type MaintenanceLogInsert = {
  farm_id: string;
  title: string;
  maintenance_date: string | null;
  equipment_id?: string | null;
  container_id?: string | null;
  created_by_auth_user_id?: string | null;
  entered_by_person_id?: string | null;
  description?: string | null;
  status?: string | null;
  log_type?: string;
  logged_at?: string;
};

type EquipmentOption = {
  id: string;
  nickname: string | null;
  unit_number: string | null;
  category: string | null;
};

type BuildingOption = {
  id: string;
  name: string;
  code: string | null;
};

type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

function AddMaintenanceLog({ session }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<'personal' | 'shared'>('personal');
  const [enteredByPersonId, setEnteredByPersonId] = useState('');
  const [peopleOptions, setPeopleOptions] = useState<PersonOption[]>([]);
  const [subjectType, setSubjectType] = useState<'equipment' | 'building'>('equipment');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [containerId, setContainerId] = useState('');
  const [logType, setLogType] = useState<'maintenance' | 'inspection'>('maintenance');
  const [maintenanceDate, setMaintenanceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [logStatus, setLogStatus] = useState<'open' | 'closed'>('open');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { moduleEnabledByKey, loading: navLoading } = useNavData();
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);

  const equipmentLabel = useMemo(() => {
    return equipmentOptions.reduce<Record<string, string>>((acc, item) => {
      const labelParts = [
        item.unit_number ? `Unit ${item.unit_number}` : null,
        item.nickname,
      ].filter(Boolean);
      acc[item.id] = labelParts.join(' - ') || 'Unknown equipment';
      return acc;
    }, {});
  }, [equipmentOptions]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        equipmentOptions
          .map((item) => item.category)
          .filter((cat): cat is string => Boolean(cat)),
      ),
    ).sort();
  }, [equipmentOptions]);

  const filteredEquipment = useMemo(() => {
    let items = equipmentOptions;
    if (categoryFilter) {
      items = items.filter((item) => item.category === categoryFilter);
    }
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      items = items.filter((item) => {
        const haystack = [item.nickname, item.unit_number, item.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    return items;
  }, [equipmentOptions, categoryFilter, searchFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setError(null);
      if (navLoading) return;
      if (!maintenanceEnabled) {
        setEquipmentOptions([]);
        setBuildingOptions([]);
        setPeopleOptions([]);
        setActiveFarmId(null);
        setError('Maintenance module is disabled for this farm.');
        return;
      }
      const { farmId, membership, profile } = await fetchActiveFarmContext(
        session.user.id,
      );
      if (!active) return;
      setActiveFarmId(farmId);
      setAccountMode(membership?.account_mode ?? 'personal');
      const defaultPersonId = membership?.person_id ?? '';
      setEnteredByPersonId(defaultPersonId);

      if (!farmId) {
        setError('No farm assigned to your profile.');
        setEquipmentOptions([]);
        setBuildingOptions([]);
        return;
      }

      if (equipmentEnabled) {
        const { data: equipmentData, error: err } = await supabase
          .from('equipment')
          .select('id, nickname, unit_number, category')
          .eq('farm_id', farmId)
          .eq('active', true)
          .order('nickname', { ascending: true });
        if (!active) return;
        if (err) {
          setError(err.message);
          setEquipmentOptions([]);
        } else {
          setEquipmentOptions(equipmentData ?? []);
        }
      } else {
        setEquipmentOptions([]);
      }

      if (buildingsEnabled) {
        const { data: buildingData, error: buildingErr } = await supabase
          .from('containers')
          .select('id, name, code')
          .eq('farm_id', farmId)
          .eq('container_kind', 'building')
          .eq('active', true)
          .order('name', { ascending: true });
        if (!active) return;
        if (buildingErr) {
          setError(buildingErr.message);
          setBuildingOptions([]);
        } else {
          setBuildingOptions(buildingData ?? []);
        }
      } else {
        setBuildingOptions([]);
      }

      const { data: peopleData, error: peopleErr } = await supabase
        .from('people')
        .select('id, first_name, last_name, display_name')
        .eq('farm_id', farmId)
        .eq('active', true)
        .order('display_name', { ascending: true });
      if (!active) return;
      if (peopleErr) {
        setError(peopleErr.message);
        setPeopleOptions([]);
      } else {
        setPeopleOptions(peopleData ?? []);
        if (
          membership?.account_mode !== 'shared' &&
          !defaultPersonId &&
          profile?.display_name
        ) {
          const profileName = profile.display_name.trim().toLowerCase();
          const match = (peopleData ?? []).find((person) => {
            const display = person.display_name?.trim().toLowerCase() ?? '';
            const fullName = [person.first_name, person.last_name]
              .filter(Boolean)
              .join(' ')
              .trim()
              .toLowerCase();
            return display === profileName || fullName === profileName;
          });
          if (match) {
            setEnteredByPersonId(match.id);
          }
        }
      }
    };

    load();

    const params = new URLSearchParams(location.search);
    const preselectEquipment = params.get('equipment_id');
    const preselectContainer = params.get('container_id');
    if (preselectContainer) {
      setSubjectType('building');
      setContainerId(preselectContainer);
    } else if (preselectEquipment) {
      setSubjectType('equipment');
      setEquipmentId(preselectEquipment);
    }
    return () => {
      active = false;
    };
  }, [
    session.user.id,
    location.search,
    maintenanceEnabled,
    equipmentEnabled,
    buildingsEnabled,
    navLoading,
  ]);

  // if equipment module is off but buildings are on, default to buildings
  useEffect(() => {
    if (!equipmentEnabled && buildingsEnabled) {
      setSubjectType('building');
    }
  }, [equipmentEnabled, buildingsEnabled]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!maintenanceEnabled) {
      setError('Maintenance module is disabled for this farm.');
      return;
    }
    if (subjectType === 'equipment' && !equipmentId) {
      setError('Select the equipment this log is for.');
      return;
    }
    if (subjectType === 'building' && !containerId) {
      setError('Select the building this log is for.');
      return;
    }
    if (!activeFarmId) {
      setError('No farm assigned to your profile.');
      return;
    }

    const personId = enteredByPersonId || null;
    if (accountMode === 'shared' && !personId) {
      setError('Select the person who completed this work.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: MaintenanceLogInsert = {
      farm_id: activeFarmId,
      equipment_id: subjectType === 'equipment' ? equipmentId : null,
      container_id: subjectType === 'building' ? containerId : null,
      created_by_auth_user_id: session.user.id,
      entered_by_person_id: personId,
      title,
      description: description || null,
      status: logStatus,
      log_type: logType,
      maintenance_date: maintenanceDate || null,
      logged_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('maintenance_logs')
      .insert(payload);

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  };

  const showSubjectPicker = equipmentEnabled && buildingsEnabled;

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Add Log" />
      <div className="app">
        <div className="card">
          <h1>Add Log</h1>
          <form onSubmit={handleSubmit} className="stack">
            {showSubjectPicker && (
              <label className="stack">
                <span>What is this log for?</span>
                <select
                  value={subjectType}
                  onChange={(e) => {
                    setSubjectType(e.target.value as 'equipment' | 'building');
                    setError(null);
                  }}
                >
                  <option value="equipment">Equipment (machines, trucks…)</option>
                  <option value="building">Building (bins, sheds, shop…)</option>
                </select>
              </label>
            )}

            <label className="stack">
              <span>Type of log</span>
              <select
                value={logType}
                onChange={(e) =>
                  setLogType(e.target.value as 'maintenance' | 'inspection')
                }
              >
                <option value="maintenance">Maintenance — work done</option>
                <option value="inspection">Inspection — checked, condition noted</option>
              </select>
            </label>

            <label className="stack">
              <span>Date</span>
              <input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </label>

            <label className="stack">
              <span>Status</span>
              <select
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value as 'open' | 'closed')}
              >
                <option value="open">Open — still needs work</option>
                <option value="closed">Closed — all done</option>
              </select>
            </label>

            {subjectType === 'equipment' ? (
              <>
                <label className="stack">
                  <span>Category</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setEquipmentId('');
                    }}
                  >
                    <option value="">All categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="stack">
                  <span>Search equipment</span>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => {
                      setSearchFilter(e.target.value);
                      setEquipmentId('');
                    }}
                    placeholder="Search nickname, unit #, or category"
                  />
                </label>

                {searchFilter.trim() && (
                  <div
                    className="card"
                    style={{ padding: '0.75rem', boxShadow: 'var(--shadow-2)' }}
                  >
                    <div style={{ marginBottom: '0.35rem', fontWeight: 700 }}>
                      Results
                    </div>
                    {filteredEquipment.length === 0 && <p>No matches</p>}
                    {filteredEquipment.length > 0 && (
                      <div className="stack" style={{ gap: '0.4rem' }}>
                        {filteredEquipment.slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="secondary"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setEquipmentId(item.id);
                              setSearchFilter('');
                            }}
                          >
                            {equipmentLabel[item.id] ?? 'Unknown equipment'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <label className="stack">
                  <span>Equipment</span>
                  <select
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    required={subjectType === 'equipment'}
                  >
                    <option value="">Select equipment</option>
                    {filteredEquipment.map((item) => (
                      <option key={item.id} value={item.id}>
                        {equipmentLabel[item.id] ?? 'Unknown equipment'}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="stack">
                <span>Building</span>
                <select
                  value={containerId}
                  onChange={(e) => setContainerId(e.target.value)}
                  required={subjectType === 'building'}
                >
                  <option value="">Select building</option>
                  {buildingOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.code ? ` (${item.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="stack">
              <span>Person who did the work</span>
              <select
                value={enteredByPersonId}
                onChange={(e) => setEnteredByPersonId(e.target.value)}
                required={accountMode === 'shared'}
              >
                <option value="">Select a person</option>
                {peopleOptions.map((person) => {
                  const label =
                    person.display_name ||
                    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
                    'Unnamed';
                  return (
                    <option key={person.id} value={person.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="stack">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  logType === 'inspection'
                    ? 'e.g. Pre-season inspection'
                    : 'e.g. Oil change and filters'
                }
                required
              />
            </label>

            <label className="stack">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Add Log'}
            </button>

            {error && <p className="status error">{error}</p>}
          </form>
        </div>
      </div>
    </>
  );
}

export default AddMaintenanceLog;
