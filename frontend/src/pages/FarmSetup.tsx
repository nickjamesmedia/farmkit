import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import Nav from '../components/Nav';

type Props = {
  session: Session;
};

type Farm = {
  id?: string;
  name: string;
  admin_user_id: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  app_url: string | null;
  favicon_url: string | null;
  logo_url: string | null;
};

type Location = {
  id?: string;
  farm_id: string | null;
  name: string;
  code: string | null;
  is_primary: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
  notes: string | null;
};

type UserOption = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

function FarmSetup({ session }: Props) {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [locationStatus, setLocationStatus] = useState('');

  const adminName = (user: UserOption) => {
    const name =
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.name ||
      user.email;
    return `${name} (${user.email})`;
  };

  const farmState = useMemo(() => {
    return (
      farm ?? {
        name: '',
        admin_user_id: null,
        email: '',
        phone: '',
        website_url: '',
        app_url: '',
        favicon_url: '',
        logo_url: '',
      }
    );
  }, [farm]);

  const locationState = useMemo(() => {
    return (
      location ?? {
        farm_id: farmState.id ?? null,
        name: farmState.name ? `${farmState.name} HQ` : 'Primary Location',
        code: '',
        is_primary: true,
        address_line1: '',
        address_line2: '',
        city: '',
        province: '',
        postal_code: '',
        country: 'Canada',
        nearest_town: '',
        nearest_hospital_name: '',
        nearest_hospital_distance_km: null,
        emergency_instructions: '',
        notes: '',
      }
    );
  }, [location, farmState.id, farmState.name]);

  const ensurePrimaryLocation = async (farmId: string, farmName?: string) => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('farm_id', farmId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);
    if (data && data.length > 0) {
      setLocation(data[0] as Location);
      return data[0] as Location;
    }
    const insertPayload = {
      farm_id: farmId,
      name: farmName ? `${farmName} HQ` : 'Primary Location',
      is_primary: true,
    };
    const { data: inserted, error: insertErr } = await supabase
      .from('locations')
      .insert(insertPayload)
      .select()
      .maybeSingle();
    if (!insertErr && inserted) {
      setLocation(inserted as Location);
      return inserted as Location;
    }
    return null;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      const [{ data: farmData, error: farmErr }, { data: usersData, error: usersErr }] =
        await Promise.all([
          supabase
            .from('farms')
            .select(
              'id, name, admin_user_id, email, phone, website_url, app_url, favicon_url, logo_url',
            )
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('app_users')
            .select('id, name, first_name, last_name, email')
            .order('name', { ascending: true }),
        ]);

      if (!active) return;
      if (farmErr) {
        setError(farmErr.message);
      } else {
        setFarm(farmData ?? null);
        if (farmData?.id) {
          await ensurePrimaryLocation(farmData.id, farmData.name ?? undefined);
        }
      }
      if (usersErr) {
        setError(usersErr.message);
      } else {
        setUsers(usersData ?? []);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setStatus('');

    const payload: Farm = {
      id: farmState.id,
      name: farmState.name.trim(),
      admin_user_id: farmState.admin_user_id || null,
      email: farmState.email || null,
      phone: farmState.phone || null,
      website_url: farmState.website_url || null,
      app_url: farmState.app_url || null,
      favicon_url: farmState.favicon_url || null,
      logo_url: farmState.logo_url || null,
    };

    const { data: saved, error: upsertError } = await supabase
      .from('farms')
      .upsert(payload)
      .select()
      .maybeSingle();
    if (upsertError || !saved) {
      setError(upsertError?.message ?? 'Unable to save farm');
      setSaving(false);
      return;
    }

    setFarm(saved as Farm);
    if (saved.id) {
      await ensurePrimaryLocation(saved.id, saved.name);
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
    const payload = {
      ...locationState,
      farm_id: farmState.id,
      is_primary: true,
    };
    const { data, error: locErr } = await supabase
      .from('locations')
      .upsert(payload)
      .select()
      .maybeSingle();
    if (locErr) {
      setLocationStatus(locErr.message);
    } else {
      setLocation(data as Location);
      setLocationStatus('Location saved.');
    }
    setSavingLocation(false);
  };

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
                <span>Farm admin (user)</span>
                <select
                  value={farmState.admin_user_id ?? ''}
                  onChange={(e) =>
                    setFarm({
                      ...farmState,
                      admin_user_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Select admin</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {adminName(u)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="stack">
                <span>Farm email</span>
                <input
                  type="email"
                  value={farmState.email ?? ''}
                  onChange={(e) =>
                    setFarm({ ...farmState, email: e.target.value })
                  }
                  placeholder="farm@example.com"
                />
              </label>

              <label className="stack">
                <span>Farm phone</span>
                <input
                  type="tel"
                  value={farmState.phone ?? ''}
                  onChange={(e) =>
                    setFarm({ ...farmState, phone: e.target.value })
                  }
                  placeholder="555-123-4567"
                />
              </label>

              <label className="stack">
                <span>Farm website</span>
                <input
                  type="url"
                  value={farmState.website_url ?? ''}
                  onChange={(e) =>
                    setFarm({ ...farmState, website_url: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </label>

              <label className="stack">
                <span>Farm app URL</span>
                <input
                  type="url"
                  value={farmState.app_url ?? ''}
                  onChange={(e) =>
                    setFarm({ ...farmState, app_url: e.target.value })
                  }
                  placeholder="https://app.example.com"
                />
              </label>

              <label className="stack">
                <span>Favicon URL</span>
                <input
                  type="url"
                  value={farmState.favicon_url ?? ''}
                  onChange={(e) =>
                    setFarm({ ...farmState, favicon_url: e.target.value })
                  }
                  placeholder="https://example.com/favicon.ico"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!farmState.website_url) {
                      setError('Website URL required to fetch favicon.');
                      return;
                    }
                    try {
                      const url = new URL(farmState.website_url);
                      const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
                      setFarm({ ...farmState, favicon_url: favicon });
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
                  value={farmState.logo_url ?? ''}
                  onChange={(e) =>
                    setFarm({ ...farmState, logo_url: e.target.value })
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
          <h2>Location</h2>
          <form className="stack" onSubmit={handleLocationSave}>
              <label className="stack">
                <span>Location name</span>
                <input
                  type="text"
                  value={locationState.name}
                  onChange={(e) => setLocation({ ...(locationState as Location), name: e.target.value })}
                  required
                />
              </label>
              <label className="stack">
                <span>Code</span>
                <input
                  type="text"
                  value={locationState.code ?? ''}
                  onChange={(e) => setLocation({ ...(locationState as Location), code: e.target.value })}
                />
              </label>
              <label className="stack">
                <span>Address line 1</span>
                <input
                  type="text"
                  value={locationState.address_line1 ?? ''}
                  onChange={(e) =>
                    setLocation({ ...(locationState as Location), address_line1: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Address line 2</span>
                <input
                  type="text"
                  value={locationState.address_line2 ?? ''}
                  onChange={(e) =>
                    setLocation({ ...(locationState as Location), address_line2: e.target.value })
                  }
                />
              </label>
              <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                <label className="stack">
                  <span>City</span>
                  <input
                    type="text"
                    value={locationState.city ?? ''}
                    onChange={(e) => setLocation({ ...(locationState as Location), city: e.target.value })}
                  />
                </label>
                <label className="stack">
                  <span>Province</span>
                  <input
                    type="text"
                    value={locationState.province ?? ''}
                    onChange={(e) =>
                      setLocation({ ...(locationState as Location), province: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Postal code</span>
                  <input
                    type="text"
                    value={locationState.postal_code ?? ''}
                    onChange={(e) =>
                      setLocation({ ...(locationState as Location), postal_code: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span>Country</span>
                  <input
                    type="text"
                    value={locationState.country ?? ''}
                    onChange={(e) =>
                      setLocation({ ...(locationState as Location), country: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="stack">
                <span>Nearest town</span>
                <input
                  type="text"
                  value={locationState.nearest_town ?? ''}
                  onChange={(e) =>
                    setLocation({ ...(locationState as Location), nearest_town: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span>Nearest hospital name</span>
                <input
                  type="text"
                  value={locationState.nearest_hospital_name ?? ''}
                  onChange={(e) =>
                    setLocation({
                      ...(locationState as Location),
                      nearest_hospital_name: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span>Nearest hospital distance (km)</span>
                <input
                  type="number"
                  value={locationState.nearest_hospital_distance_km ?? ''}
                  onChange={(e) =>
                    setLocation({
                      ...(locationState as Location),
                      nearest_hospital_distance_km:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="stack">
                <span>Emergency instructions</span>
                <textarea
                  value={locationState.emergency_instructions ?? ''}
                  onChange={(e) =>
                    setLocation({
                      ...(locationState as Location),
                      emergency_instructions: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span>Notes</span>
                <textarea
                  value={locationState.notes ?? ''}
                  onChange={(e) =>
                    setLocation({ ...(locationState as Location), notes: e.target.value })
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
