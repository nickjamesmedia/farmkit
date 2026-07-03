import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchActiveFarmContext } from '../lib/farmContext';
import { toSlug } from '../utils/slug';
import Nav from '../components/Nav';
import { useNavData } from '../lib/navDataContext';

type Props = {
  session: Session;
};

type Farm = {
  id?: string;
  name: string;
  slug: string;
  parent_farm_id: string | null;
};

type FarmDetails = {
  farm_id?: string;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  app_url: string | null;
  favicon_url: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
};

type ModuleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  default_enabled: boolean;
};

type FarmModuleRow = {
  module_id: string;
  enabled: boolean;
};

type FarmErp = {
  farm_id?: string;
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
};

function FarmSetup({ session }: Props) {
  const { roleKey, loading: navLoading } = useNavData();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [details, setDetails] = useState<FarmDetails | null>(null);
  const [erp, setErp] = useState<FarmErp | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [moduleSelections, setModuleSelections] = useState<Record<string, boolean>>({});
  const [moduleBaseline, setModuleBaseline] = useState<Record<string, boolean>>({});
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSaving, setModulesSaving] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [modulesStatus, setModulesStatus] = useState('');

  const farmState = useMemo(() => {
    return (
      farm ?? {
        name: '',
        slug: '',
        parent_farm_id: null,
      }
    );
  }, [farm]);

  const detailsState = useMemo(() => {
    return (
      details ?? {
        farm_id: farmState.id,
        primary_contact_name: '',
        primary_contact_phone: '',
        email: '',
        phone: '',
        website_url: '',
        app_url: '',
        favicon_url: '',
        logo_url: '',
        address_line1: '',
        address_line2: '',
        city: '',
        province: '',
        postal_code: '',
        country: 'Canada',
        notes: '',
      }
    );
  }, [details, farmState.id]);

  const erpState = useMemo(() => {
    return (
      erp ?? {
        farm_id: farmState.id,
        nearest_town: '',
        nearest_hospital_name: '',
        nearest_hospital_distance_km: null,
        emergency_instructions: '',
      }
    );
  }, [erp, farmState.id]);

  const erpModule = useMemo(() => {
    return modules.find((row) => row.key === 'erp') ?? null;
  }, [modules]);

  const erpEnabled = useMemo(() => {
    if (!erpModule) return true;
    return moduleSelections[erpModule.id] ?? erpModule.default_enabled;
  }, [erpModule, moduleSelections]);

  const upsertFarmDetails = async (farmId: string) => {
    const payload = {
      farm_id: farmId,
      primary_contact_name: detailsState.primary_contact_name || null,
      primary_contact_phone: detailsState.primary_contact_phone || null,
      email: detailsState.email || null,
      phone: detailsState.phone || null,
      website_url: detailsState.website_url || null,
      app_url: detailsState.app_url || null,
      favicon_url: detailsState.favicon_url || null,
      logo_url: detailsState.logo_url || null,
      address_line1: detailsState.address_line1 || null,
      address_line2: detailsState.address_line2 || null,
      city: detailsState.city || null,
      province: detailsState.province || null,
      postal_code: detailsState.postal_code || null,
      country: detailsState.country || null,
      notes: detailsState.notes || null,
      updated_at: new Date().toISOString(),
      updated_by_auth_user_id: session.user.id,
    };

    return supabase.from('farm_details').upsert(payload).select().maybeSingle();
  };

  const upsertFarmErp = async (farmId: string) => {
    const payload = {
      farm_id: farmId,
      nearest_town: erpState.nearest_town || null,
      nearest_hospital_name: erpState.nearest_hospital_name || null,
      nearest_hospital_distance_km: erpState.nearest_hospital_distance_km ?? null,
      emergency_instructions: erpState.emergency_instructions || null,
      updated_at: new Date().toISOString(),
      updated_by_auth_user_id: session.user.id,
    };

    return supabase.from('farm_erp').upsert(payload).select().maybeSingle();
  };

  useEffect(() => {
    let active = true;
    const loadModules = async () => {
      if (navLoading) return;
      if (roleKey !== 'admin') {
        setModules([]);
        setModuleSelections({});
        setModuleBaseline({});
        return;
      }
      if (!farmState.id) {
        setModules([]);
        setModuleSelections({});
        setModuleBaseline({});
        return;
      }

      setModulesLoading(true);
      setModulesError(null);
      setModulesStatus('');

      const [
        { data: moduleRows, error: modulesErr },
        { data: farmModuleRows, error: farmModulesErr },
      ] = await Promise.all([
        supabase
          .from('modules')
          .select('id, key, name, description, default_enabled')
          .order('name', { ascending: true }),
        supabase
          .from('farm_modules')
          .select('module_id, enabled')
          .eq('farm_id', farmState.id),
      ]);

      if (!active) return;
      if (modulesErr || farmModulesErr) {
        setModulesError(modulesErr?.message ?? farmModulesErr?.message ?? 'Unable to load modules');
        setModules([]);
        setModuleSelections({});
        setModuleBaseline({});
        setModulesLoading(false);
        return;
      }

      const modulesList = (moduleRows as ModuleRow[]) ?? [];
      const moduleOrder = [
        'equipment',
        'maintenance',
        'containers',
        'containers_buildings',
        'erp',
        'containers_storage',
      ];
      modulesList.sort((a, b) => {
        const ai = moduleOrder.indexOf(a.key);
        const bi = moduleOrder.indexOf(b.key);
        if (ai !== -1 || bi !== -1) {
          return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
        }
        return a.name.localeCompare(b.name);
      });
      const farmModuleMap = new Map(
        ((farmModuleRows as FarmModuleRow[]) ?? []).map((row) => [row.module_id, row.enabled]),
      );
      const selections: Record<string, boolean> = {};
      modulesList.forEach((module) => {
        selections[module.id] =
          farmModuleMap.get(module.id) ?? module.default_enabled;
      });

      setModules(modulesList);
      setModuleSelections(selections);
      setModuleBaseline(selections);
      setModulesLoading(false);
    };

    loadModules();
    return () => {
      active = false;
    };
  }, [farmState.id, roleKey, navLoading]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      if (navLoading) return;
      if (roleKey !== 'admin') {
        setError('Admin access required.');
        setLoading(false);
        return;
      }
      const { farmId } = await fetchActiveFarmContext(session.user.id);
      if (!farmId) {
        setError('No farm assigned to your profile.');
        setLoading(false);
        return;
      }

      const { data: farmData, error: farmErr } = await supabase
        .from('farms')
        .select('id, name, slug, parent_farm_id')
        .eq('id', farmId)
        .maybeSingle();
      if (!active) return;
      if (farmErr) {
        setError(farmErr.message);
        setLoading(false);
        return;
      }

      let targetFarm = farmData ?? null;
      if (farmData?.parent_farm_id) {
        const { data: parentFarm } = await supabase
          .from('farms')
          .select('id, name, slug, parent_farm_id')
          .eq('id', farmData.parent_farm_id)
          .maybeSingle();
        targetFarm = parentFarm ?? farmData ?? null;
      }

      const { data: detailsData, error: detailsErr } = await supabase
        .from('farm_details')
        .select(
          'farm_id, primary_contact_name, primary_contact_phone, email, phone, website_url, app_url, favicon_url, logo_url, address_line1, address_line2, city, province, postal_code, country, notes',
        )
        .eq('farm_id', targetFarm?.id ?? farmId)
        .maybeSingle();
      const { data: erpData } = await supabase
        .from('farm_erp')
        .select(
          'farm_id, nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions',
        )
        .eq('farm_id', targetFarm?.id ?? farmId)
        .maybeSingle();
      if (!active) return;
      if (detailsErr) {
        setError(detailsErr.message);
      }

      setFarm(
        targetFarm
          ? {
              id: targetFarm.id,
              name: targetFarm.name,
              slug: targetFarm.slug,
              parent_farm_id: targetFarm.parent_farm_id ?? null,
            }
          : null,
      );
      setDetails((detailsData as FarmDetails) ?? null);
      setErp((erpData as FarmErp) ?? null);
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [session.user.id, roleKey, navLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setStatus('');

    const name = farmState.name.trim();
    if (!name) {
      setError('Farm name is required.');
      setSaving(false);
      return;
    }

    const slug = farmState.slug?.trim() || toSlug(name);

    let savedFarm: Farm | null = null;
    if (farmState.id) {
      const { data, error: upsertError } = await supabase
        .from('farms')
        .upsert({
          id: farmState.id,
          name,
          slug,
          parent_farm_id: farmState.parent_farm_id ?? null,
        })
        .select()
        .maybeSingle();
      if (upsertError || !data) {
        setError(upsertError?.message ?? 'Unable to save farm');
        setSaving(false);
        return;
      }
      savedFarm = data as Farm;
    } else {
      const { data, error: insertError } = await supabase
        .from('farms')
        .insert({
          name,
          slug,
          parent_farm_id: farmState.parent_farm_id ?? null,
          created_by_auth_user_id: session.user.id,
        })
        .select()
        .maybeSingle();
      if (insertError || !data) {
        setError(insertError?.message ?? 'Unable to create farm');
        setSaving(false);
        return;
      }
      savedFarm = data as Farm;
    }

    setFarm(savedFarm);
    if (savedFarm?.id) {
      const { data, error: detailsErr } = await upsertFarmDetails(savedFarm.id);
      if (detailsErr) {
        setError(detailsErr.message);
      } else {
        setDetails(data as FarmDetails);
      }
      if (erpEnabled) {
        const { data: erpRow, error: erpErr } = await upsertFarmErp(savedFarm.id);
        if (erpErr) {
          setError(erpErr.message);
        } else {
          setErp((erpRow as FarmErp) ?? null);
        }
      }
    }
    setStatus('Farm settings saved.');
    setSaving(false);
  };

  const handleLocationSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!farmState.id) {
      setLocationStatus('Save farm first.');
      return;
    }
    setSavingLocation(true);
    setLocationStatus('');
    const { data, error: locErr } = await upsertFarmDetails(farmState.id);
    if (locErr) {
      setLocationStatus(locErr.message);
    } else {
      setDetails(data as FarmDetails);
      if (erpEnabled) {
        const { data: erpRow, error: erpErr } = await upsertFarmErp(farmState.id);
        if (erpErr) {
          setLocationStatus(erpErr.message);
        } else {
          setErp((erpRow as FarmErp) ?? null);
          setLocationStatus('Location saved.');
        }
      } else {
        setLocationStatus('Location saved.');
      }
    }
    setSavingLocation(false);
  };

  const handleModuleApply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!farmState.id) {
      setModulesStatus('Save farm first.');
      return;
    }

    setModulesSaving(true);
    setModulesError(null);
    setModulesStatus('');

    const now = new Date().toISOString();
    const payload = modules.map((module) => ({
      farm_id: farmState.id,
      module_id: module.id,
      enabled: moduleSelections[module.id] ?? module.default_enabled,
      enabled_at: moduleSelections[module.id] ? now : null,
      updated_at: now,
      updated_by_auth_user_id: session.user.id,
    }));

    const { error: upsertErr } = await supabase
      .from('farm_modules')
      .upsert(payload, { onConflict: 'farm_id,module_id' });

    if (upsertErr) {
      setModulesError(upsertErr.message);
      setModulesSaving(false);
      return;
    }

    setModuleBaseline({ ...moduleSelections });
    setModulesStatus('Module settings updated.');
    setModulesSaving(false);
  };

  const hasModuleChanges = useMemo(() => {
    return modules.some((module) => moduleSelections[module.id] !== moduleBaseline[module.id]);
  }, [moduleBaseline, moduleSelections, modules]);

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Farm Setup" />
      <div className="app">
        <div className="card stack">
          <h1>Farm Setup</h1>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <form className="stack" onSubmit={handleSubmit}>
              <label className="stack">
                <span>Farm name</span>
                <input
                  type="text"
                  value={farmState.name}
                  onChange={(e) =>
                    setFarm({ ...farmState, name: e.target.value })
                  }
                  required
                />
              </label>

              <label className="stack">
                <span>Primary contact name</span>
                <input
                  type="text"
                  value={detailsState.primary_contact_name ?? ''}
                  onChange={(e) =>
                    setDetails({
                      ...detailsState,
                      primary_contact_name: e.target.value,
                    })
                  }
                  placeholder="Farm owner or main contact"
                />
              </label>

              <label className="stack">
                <span>Primary contact phone</span>
                <input
                  type="tel"
                  value={detailsState.primary_contact_phone ?? ''}
                  onChange={(e) =>
                    setDetails({
                      ...detailsState,
                      primary_contact_phone: e.target.value,
                    })
                  }
                  placeholder="555-123-4567"
                />
              </label>

              <label className="stack">
                <span>Farm email</span>
                <input
                  type="email"
                  value={detailsState.email ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, email: e.target.value })
                  }
                  placeholder="farm@example.com"
                />
              </label>

              <label className="stack">
                <span>Farm phone</span>
                <input
                  type="tel"
                  value={detailsState.phone ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, phone: e.target.value })
                  }
                  placeholder="555-123-4567"
                />
              </label>

              <label className="stack">
                <span>Farm website</span>
                <input
                  type="url"
                  value={detailsState.website_url ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, website_url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </label>

              <label className="stack">
                <span>Farm app URL</span>
                <input
                  type="url"
                  value={detailsState.app_url ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, app_url: e.target.value })
                  }
                  placeholder="https://app.example.com"
                />
              </label>

              <label className="stack">
                <span>Favicon URL</span>
                <input
                  type="url"
                  value={detailsState.favicon_url ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, favicon_url: e.target.value })
                  }
                  placeholder="https://example.com/favicon.ico"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!detailsState.website_url) {
                      setError('Website URL required to fetch favicon.');
                      return;
                    }
                    try {
                      const url = new URL(detailsState.website_url);
                      const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
                      setDetails({ ...detailsState, favicon_url: favicon });
                      setStatus('Favicon set from website.');
                      setError(null);
                    } catch (_err) {
                      setError('Website URL is invalid for favicon.');
                    }
                  }}
                >
                  Fetch favicon from website
                </button>
              </label>

              <label className="stack">
                <span>Logo URL</span>
                <input
                  type="url"
                  value={detailsState.logo_url ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, logo_url: e.target.value })
                  }
                  placeholder="https://example.com/logo.png"
                />
              </label>

              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>

              {status && <p className="status">{status}</p>}
              {error && <p className="status">{error}</p>}
            </form>
          )}
        </div>
        <div className="card stack">
          <h2>Farm Modules</h2>
          <form className="stack" onSubmit={handleModuleApply}>
            {modulesLoading && <p>Loading modules...</p>}
            {modulesError && <p className="status">{modulesError}</p>}
            {!modulesLoading && modules.length === 0 && (
              <p>No modules available.</p>
            )}
             {!modulesLoading && modules.length > 0 && (
               <div className="stack" style={{ gap: '0.5rem' }}>
                {(() => {
                  const containersModule =
                    modules.find((row) => row.key === 'containers') ?? null;
                  const containersEnabled = containersModule
                    ? (moduleSelections[containersModule.id] ??
                      containersModule.default_enabled)
                    : true;

                  return modules.map((module) => {
                    const isContainersChild =
                      module.key.startsWith('containers_') &&
                      module.key !== 'containers';
                    const disabledByParent =
                      isContainersChild && !containersEnabled;
                    const checked =
                      moduleSelections[module.id] ?? module.default_enabled;

                    return (
                      <label
                        key={module.id}
                        title={
                          disabledByParent
                            ? 'Disabled because Containers is turned off.'
                            : undefined
                        }
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.25rem 1fr',
                          gap: '0.75rem',
                          alignItems: 'start',
                          paddingLeft: isContainersChild ? '1.25rem' : undefined,
                          opacity: disabledByParent ? 0.55 : 1,
                          cursor: disabledByParent ? 'not-allowed' : undefined,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={modulesSaving || disabledByParent}
                          onChange={(e) =>
                            setModuleSelections({
                              ...moduleSelections,
                              [module.id]: e.target.checked,
                            })
                          }
                          style={{ width: 'auto', marginTop: '0.2rem' }}
                        />
                        <span className="stack" style={{ gap: '0.2rem' }}>
                          <strong>{module.name}</strong>
                          {module.description && (
                            <span style={{ color: '#475569', fontSize: '0.9rem' }}>
                              {module.description}
                            </span>
                          )}
                          {disabledByParent && (
                            <span style={{ color: '#475569', fontSize: '0.85rem' }}>
                              Inactive while Containers is disabled.
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  });
                })()}
              </div>
            )}
            {modulesSaving && (
              <p className="status">
                Heads up: applying module changes. This can take a moment.
              </p>
            )}
            <button type="submit" disabled={modulesSaving || !hasModuleChanges}>
              {modulesSaving ? 'Applying...' : 'Apply changes'}
            </button>
            {modulesStatus && <p className="status">{modulesStatus}</p>}
          </form>
        </div>
        <div className="card stack">
          <h2>Location</h2>
          <form className="stack" onSubmit={handleLocationSave}>
            <label className="stack">
              <span>Address line 1</span>
              <input
                type="text"
                value={detailsState.address_line1 ?? ''}
                onChange={(e) =>
                  setDetails({
                    ...detailsState,
                    address_line1: e.target.value,
                  })
                }
              />
            </label>
            <label className="stack">
              <span>Address line 2</span>
              <input
                type="text"
                value={detailsState.address_line2 ?? ''}
                onChange={(e) =>
                  setDetails({
                    ...detailsState,
                    address_line2: e.target.value,
                  })
                }
              />
            </label>
            <div
              style={{
                display: 'grid',
                gap: '0.5rem',
                gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
              }}
            >
              <label className="stack">
                <span>City</span>
                <input
                  type="text"
                  value={detailsState.city ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, city: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Province</span>
                <input
                  type="text"
                  value={detailsState.province ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, province: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Postal code</span>
                <input
                  type="text"
                  value={detailsState.postal_code ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, postal_code: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Country</span>
                <input
                  type="text"
                  value={detailsState.country ?? ''}
                  onChange={(e) =>
                    setDetails({ ...detailsState, country: e.target.value })
                  }
                />
              </label>
            </div>
            {erpEnabled ? (
              <>
                <label className="stack">
                  <span>Nearest town</span>
                  <input
                    type="text"
                    value={erpState.nearest_town ?? ''}
                    onChange={(e) =>
                      setErp({
                        ...erpState,
                        nearest_town: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Nearest hospital name</span>
                  <input
                    type="text"
                    value={erpState.nearest_hospital_name ?? ''}
                    onChange={(e) =>
                      setErp({
                        ...erpState,
                        nearest_hospital_name: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Nearest hospital distance (km)</span>
                  <input
                    type="number"
                    value={erpState.nearest_hospital_distance_km ?? ''}
                    onChange={(e) =>
                      setErp({
                        ...erpState,
                        nearest_hospital_distance_km:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Emergency instructions</span>
                  <textarea
                    value={erpState.emergency_instructions ?? ''}
                    onChange={(e) =>
                      setErp({
                        ...erpState,
                        emergency_instructions: e.target.value,
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <p className="status">ERP module is disabled for this farm.</p>
            )}
            <label className="stack">
              <span>Notes</span>
              <textarea
                value={detailsState.notes ?? ''}
                onChange={(e) =>
                  setDetails({ ...detailsState, notes: e.target.value })
                }
              />
            </label>
            <button type="submit" disabled={savingLocation}>
              {savingLocation ? 'Saving...' : 'Save Location'}
            </button>
            {locationStatus && <p className="status">{locationStatus}</p>}
          </form>
        </div>
      </div>
    </>
  );
}

export default FarmSetup;
