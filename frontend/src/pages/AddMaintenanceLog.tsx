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

type MaintenanceLog = {
  id: string;
  farm_id: string;
  equipment_id: string;
  container_id: string | null;
  created_by_auth_user_id: string | null;
  entered_by_person_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  logged_at: string;
  hours_on_meter: number | null;
  next_due_at: string | null;
  maintenance_date: string | null;
};

type MaintenanceLogInsert = Partial<
  Omit<MaintenanceLog, 'id' | 'farm_id' | 'equipment_id' | 'title'>
> &
  Pick<MaintenanceLog, 'farm_id' | 'equipment_id' | 'title' | 'maintenance_date'>;

type EquipmentOption = {
  id: string;
  nickname: string | null;
  unit_number: string | null;
  category: string | null;
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
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>(
    [],
  );
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<'personal' | 'shared'>(
    'personal',
  );
  const [enteredByPersonId, setEnteredByPersonId] = useState('');
  const [peopleOptions, setPeopleOptions] = useState<PersonOption[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
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
        const haystack = [
          item.nickname,
          item.unit_number,
          item.category,
        ]
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
        setPeopleOptions([]);
        setActiveFarmId(null);
        setError('Maintenance module is disabled for this farm.');
        return;
      }
      if (!equipmentEnabled) {
        setEquipmentOptions([]);
        setPeopleOptions([]);
        setActiveFarmId(null);
        setError('Equipment module is disabled for this farm.');
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
        return;
      }

      const { data: equipmentData, error: err } = await supabase
        .from('equipment')
        .select('id, nickname, unit_number, category')
        .eq('farm_id', farmId)
        .order('nickname', { ascending: true });
      if (!active) return;
      if (err) {
        setError(err.message);
        setEquipmentOptions([]);
      } else {
        setEquipmentOptions(equipmentData ?? []);
      }

      const { data: peopleData, error: peopleErr } = await supabase
        .from('people')
        .select('id, first_name, last_name, display_name')
        .eq('farm_id', farmId)
        .eq('active', true)
        .order('first_name', { ascending: true });
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
    const preselect = params.get('equipment_id');
    if (preselect) {
      setEquipmentId(preselect);
    }
    return () => {
      active = false;
    };
  }, [session.user.id, location.search, maintenanceEnabled, equipmentEnabled, navLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!maintenanceEnabled) {
      setError('Maintenance module is disabled for this farm.');
      return;
    }
    if (!equipmentEnabled) {
      setError('Equipment module is disabled for this farm.');
      return;
    }
    if (!equipmentId) {
      setError('Select equipment for this maintenance log.');
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

    const { error: insertError } = await supabase
      .from('maintenance_logs')
      .insert<MaintenanceLogInsert>({
        farm_id: activeFarmId,
        equipment_id: equipmentId,
        created_by_auth_user_id: session.user.id,
        entered_by_person_id: personId,
        title,
        description: description || null,
        status: logStatus,
        maintenance_date: maintenanceDate || null,
        logged_at: new Date().toISOString(),
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Add Maintenance Log" />
      <div className="app">
        <div className="card">
          <h1>Add Maintenance Log</h1>
          <form onSubmit={handleSubmit} className="stack">
            <label className="stack">
              <span>Maintenance date</span>
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
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>

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
                style={{
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                }}
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
                        style={{
                          textAlign: 'left',
                          background: '#fff',
                          color: '#0f172a',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.5rem 0.65rem',
                        }}
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
                required
              >
                <option value="">Select equipment</option>
                {filteredEquipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {equipmentLabel[item.id] ?? 'Unknown equipment'}
                  </option>
                ))}
              </select>
            </label>
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
                    [person.first_name, person.last_name]
                      .filter(Boolean)
                      .join(' ') ||
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
              {loading ? 'Saving...' : 'Add Maintenance Log'}
            </button>

            {error && <p className="status">{error}</p>}
          </form>
        </div>
      </div>
    </>
  );
}

export default AddMaintenanceLog;
