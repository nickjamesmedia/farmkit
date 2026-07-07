import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchActiveFarmContext } from '../lib/farmContext';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import QuickLinks from '../components/QuickLinks';

type Props = {
  session: Session;
};

type Farm = {
  id: string;
  name: string;
  slug: string;
  parent_farm_id: string | null;
};

type FarmDetails = {
  farm_id: string;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
};

type FarmErp = {
  farm_id: string;
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
  has_fuel_storage: boolean | null;
  has_chemical_storage: boolean | null;
};

type FarmWithDetails = Farm & {
  farm_details?: FarmDetails | FarmDetails[] | null;
  farm_erp?: FarmErp | FarmErp[] | null;
};

function FarmInfo({ session }: Props) {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [details, setDetails] = useState<FarmDetails | null>(null);
  const [erp, setErp] = useState<FarmErp | null>(null);
  const [childFarms, setChildFarms] = useState<FarmWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { moduleEnabledByKey, roleKey } = useNavData();
  const erpEnabled = moduleEnabledByKey.erp ?? true;

  const getDetails = (record?: FarmWithDetails | null): FarmDetails | null => {
    if (!record) return null;
    const detailsValue = record.farm_details;
    return Array.isArray(detailsValue) ? detailsValue[0] ?? null : detailsValue ?? null;
  };

  const getErp = (record?: FarmWithDetails | null): FarmErp | null => {
    if (!record) return null;
    const erpValue = record.farm_erp;
    return Array.isArray(erpValue) ? erpValue[0] ?? null : erpValue ?? null;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      const { farmId } = await fetchActiveFarmContext(session.user.id);
      if (!active) return;
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
      if (farmErr || !farmData) {
        setError(farmErr?.message ?? 'Unable to load farm.');
        setLoading(false);
        return;
      }

      let targetFarm = farmData as Farm;
      if (farmData.parent_farm_id) {
        const { data: parentFarm } = await supabase
          .from('farms')
          .select('id, name, slug, parent_farm_id')
          .eq('id', farmData.parent_farm_id)
          .maybeSingle();
        targetFarm = (parentFarm as Farm) ?? targetFarm;
      }

      const { data: detailsData, error: detailsErr } = await supabase
        .from('farm_details')
        .select(
          'farm_id, primary_contact_name, primary_contact_phone, email, phone, website_url, address_line1, address_line2, city, province, postal_code, country, notes',
        )
        .eq('farm_id', targetFarm.id)
        .maybeSingle();
      const { data: erpData } = await supabase
        .from('farm_erp')
        .select(
          'farm_id, nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions, has_fuel_storage, has_chemical_storage',
        )
        .eq('farm_id', targetFarm.id)
        .maybeSingle();
      if (!active) return;
      if (detailsErr) {
        setError(detailsErr.message);
      }

      const { data: membershipRows, error: membershipErr } = await supabase
        .from('farm_memberships')
        .select('farm_id')
        .eq('auth_user_id', session.user.id);
      if (!active) return;
      if (membershipErr) {
        setError(membershipErr.message);
      }

      const memberFarmIds = (membershipRows ?? [])
        .map((row) => row.farm_id)
        .filter(Boolean);

      let childRows: FarmWithDetails[] = [];
      if (roleKey === 'admin') {
        const { data: farmsData, error: farmsErr } = await supabase
          .from('farms')
          .select(
            'id, name, slug, parent_farm_id, farm_details:farm_details(address_line1, address_line2, city, province, postal_code, country, notes), farm_erp:farm_erp(nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions, has_fuel_storage, has_chemical_storage)',
          )
          .eq('parent_farm_id', targetFarm.id)
          .order('name', { ascending: true });
        if (!active) return;
        if (farmsErr) {
          setError(farmsErr.message);
        } else {
          childRows = (farmsData as FarmWithDetails[] | null) ?? [];
        }
      } else if (memberFarmIds.length > 0) {
        const { data: farmsData, error: farmsErr } = await supabase
          .from('farms')
          .select(
            'id, name, slug, parent_farm_id, farm_details:farm_details(address_line1, address_line2, city, province, postal_code, country, notes), farm_erp:farm_erp(nearest_town, nearest_hospital_name, nearest_hospital_distance_km, emergency_instructions, has_fuel_storage, has_chemical_storage)',
          )
          .in('id', memberFarmIds)
          .order('name', { ascending: true });
        if (!active) return;
        if (farmsErr) {
          setError(farmsErr.message);
        } else {
          childRows =
            (farmsData as FarmWithDetails[] | null)?.filter(
              (row) => row.parent_farm_id === targetFarm.id,
            ) ?? [];
        }
      }

      setFarm(targetFarm);
      setDetails((detailsData as FarmDetails) ?? null);
      setErp((erpData as FarmErp) ?? null);
      setChildFarms(childRows);
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  const renderLocation = (recordDetails: FarmDetails | null, recordErp: FarmErp | null) => {
    const detailsValue = recordDetails;
    const erpValue = recordErp;
    return (
      <div className="stack">
        <div>
          <strong>Address:</strong>{' '}
          {[detailsValue?.address_line1, detailsValue?.address_line2]
            .filter(Boolean)
            .join(', ') || '-'}
        </div>
        <div>
          <strong>City/Province:</strong>{' '}
          {[detailsValue?.city, detailsValue?.province].filter(Boolean).join(', ') ||
            '-'}
        </div>
        <div>
          <strong>Postal code:</strong> {detailsValue?.postal_code || '-'}
        </div>
        <div>
          <strong>Country:</strong> {detailsValue?.country || '-'}
        </div>
        {erpEnabled ? (
          <>
            <div>
              <strong>Nearest town:</strong> {erpValue?.nearest_town || '-'}
            </div>
            <div>
              <strong>Nearest hospital:</strong>{' '}
              {erpValue?.nearest_hospital_name || '-'}{' '}
              {erpValue?.nearest_hospital_distance_km
                ? `(${erpValue.nearest_hospital_distance_km} km)`
                : ''}
            </div>
            <div>
              <strong>Emergency instructions:</strong>{' '}
              {erpValue?.emergency_instructions || '-'}
            </div>
          </>
        ) : (
          <div className="status">ERP module is disabled for this farm.</div>
        )}
        <div>
          <strong>Notes:</strong> {detailsValue?.notes || '-'}
        </div>
      </div>
    );
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Farm Info" />
      <div className="app">
        <QuickLinks />
        <div className="card stack">
          <h1>Farm Info</h1>
          {loading && <p>Loading...</p>}
          {error && <p className="status">{error}</p>}
          {!loading && !error && (
            <>
              <div className="stack">
                <h2>Farm</h2>
                <div className="stack">
                  <div>
                    <strong>Farm name:</strong> {farm?.name ?? '-'}
                  </div>
                  <div>
                    <strong>Primary contact name:</strong>{' '}
                    {details?.primary_contact_name || '-'}
                  </div>
                  <div>
                    <strong>Primary contact phone:</strong>{' '}
                    {details?.primary_contact_phone || '-'}
                  </div>
                  <div>
                    <strong>Email:</strong> {details?.email || '-'}
                  </div>
                  <div>
                    <strong>Farm phone:</strong> {details?.phone || '-'}
                  </div>
                  <div>
                    <strong>Website:</strong> {details?.website_url || '-'}
                  </div>
                </div>
              </div>

              <div className="stack">
                <h2>Location (Emergency Response)</h2>
                {renderLocation(details, erp)}
              </div>

              <div className="stack">
                <h2>Sub-farms</h2>
                {childFarms.length === 0 && (
                  <p>No child farms assigned to your account.</p>
                )}
                {childFarms.length > 0 && (
                  <div className="stack" style={{ gap: '1rem' }}>
                    {childFarms.map((child) => {
                      const childDetails = getDetails(child);
                      const childErp = getErp(child);
                      return (
                        <div key={child.id} className="stack">
                          <h3 style={{ margin: 0 }}>{child.name}</h3>
                          {renderLocation(childDetails, childErp)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default FarmInfo;
