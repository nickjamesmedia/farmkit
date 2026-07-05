import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import Nav from '../components/Nav';
import { toSlug } from '../utils/slug';

type Props = {
  session: Session;
};

// Result types grow as modules are added; each new module should register a
// type here, a query below, and a route in rowTarget().
type ResultType = 'equipment' | 'building' | 'maintenance';

type SearchResult = {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  slug?: string;
};

const TYPE_LABEL: Record<ResultType, string> = {
  equipment: 'Equipment',
  building: 'Building',
  maintenance: 'Log',
};

function SearchPage({ session }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('term') ?? '');
  const [category, setCategory] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ResultType>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { activeFarmId, dataScopeFarmIds, moduleEnabledByKey, loading: navLoading } = useNavData();
  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);

  const farmScope = useMemo(
    () => (dataScopeFarmIds.length ? dataScopeFarmIds : activeFarmId ? [activeFarmId] : []),
    [dataScopeFarmIds, activeFarmId],
  );

  // categories are loaded up front (not derived from results) so the picker
  // is populated before the first search. Currently sourced from equipment;
  // extend per module as more categorized modules land.
  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      if (navLoading || farmScope.length === 0 || !equipmentEnabled) return;
      const { data } = await supabase
        .from('equipment')
        .select('category')
        .in('farm_id', farmScope)
        .not('category', 'is', null);
      if (!active) return;
      const distinct = Array.from(
        new Set((data ?? []).map((row: any) => row.category).filter(Boolean)),
      ).sort() as string[];
      setCategories(distinct);
    };
    loadCategories();
    return () => {
      active = false;
    };
  }, [navLoading, farmScope, equipmentEnabled]);

  useEffect(() => {
    let active = true;
    const runSearch = async () => {
      if (!term.trim()) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }
      if (navLoading) {
        setLoading(true);
        return;
      }
      if (farmScope.length === 0) {
        setError('No farm assigned to your profile.');
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const emptyRes = { data: [], error: null as any };
      const wantType = (t: ResultType) => typeFilter === 'all' || typeFilter === t;

      const [equipRes, buildingRes, maintRes] = await Promise.all([
        wantType('equipment') && equipmentEnabled
          ? supabase
              .from('equipment')
              .select('id, nickname, unit_number, category, make, model')
              .in('farm_id', farmScope)
              .or(
                `nickname.ilike.%${term}%,unit_number.ilike.%${term}%,category.ilike.%${term}%,make.ilike.%${term}%,model.ilike.%${term}%`,
              )
              .limit(20)
          : Promise.resolve(emptyRes),
        wantType('building') && buildingsEnabled
          ? supabase
              .from('containers')
              .select('id, name, code, description')
              .in('farm_id', farmScope)
              .eq('container_kind', 'building')
              .or(`name.ilike.%${term}%,code.ilike.%${term}%,description.ilike.%${term}%`)
              .limit(20)
          : Promise.resolve(emptyRes),
        wantType('maintenance') && maintenanceEnabled
          ? supabase
              .from('maintenance_logs')
              .select(
                'id, title, description, log_type, equipment:equipment_id(nickname, unit_number), container:container_id(name, code)',
              )
              .in('farm_id', farmScope)
              .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
              .limit(20)
          : Promise.resolve(emptyRes),
      ]);
      if (!active) return;

      const firstError = equipRes.error || buildingRes.error || maintRes.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const equipResults: SearchResult[] = (equipRes.data ?? [])
        .filter((row: any) => (!category ? true : row.category === category))
        .map((row: any) => ({
          id: row.id,
          type: 'equipment' as const,
          title: row.nickname || row.model || 'Equipment',
          slug: toSlug(row.nickname?.trim() || row.id),
          subtitle: [row.category, row.make, row.model, row.unit_number ? `Unit ${row.unit_number}` : null]
            .filter(Boolean)
            .join(' · '),
        }));

      const buildingResults: SearchResult[] = category
        ? []
        : (buildingRes.data ?? []).map((row: any) => ({
            id: row.id,
            type: 'building' as const,
            title: row.name,
            slug: toSlug(row.name || row.id),
            subtitle: [row.code, row.description].filter(Boolean).join(' · ') || 'Building',
          }));

      const maintResults: SearchResult[] = category
        ? []
        : (maintRes.data ?? []).map((row: any) => {
            const equip = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
            const container = Array.isArray(row.container) ? row.container[0] : row.container;
            return {
              id: row.id,
              type: 'maintenance' as const,
              title: row.title,
              subtitle: [
                row.log_type === 'inspection' ? 'Inspection' : null,
                equip?.nickname ||
                  (equip?.unit_number ? `Unit ${equip.unit_number}` : null) ||
                  container?.name,
              ]
                .filter(Boolean)
                .join(' · '),
            };
          });

      setResults([...equipResults, ...buildingResults, ...maintResults]);
      setLoading(false);
    };

    runSearch();
    return () => {
      active = false;
    };
  }, [
    term,
    category,
    typeFilter,
    farmScope,
    equipmentEnabled,
    maintenanceEnabled,
    buildingsEnabled,
    navLoading,
  ]);

  const openResult = (r: SearchResult) => {
    if (r.type === 'equipment') navigate(`/equipment/${r.slug}`);
    else if (r.type === 'building') navigate(`/buildings/${r.slug}`);
    else navigate(`/maintenance/log/${r.id}`);
  };

  return (
    <>
      <Nav session={session} email={session.user.email} pageTitle="Search" />
      <div className="app">
        <div className="card stack">
          <h1>Search</h1>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            <label className="stack">
              <span>Keyword</span>
              <input
                type="search"
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setSearchParams(
                    e.target.value ? { term: e.target.value } : {},
                    { replace: true },
                  );
                }}
                placeholder="Search equipment, buildings & logs"
              />
            </label>
            <label className="stack">
              <span>Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | ResultType)}
              >
                <option value="all">Everything</option>
                {equipmentEnabled && <option value="equipment">Equipment</option>}
                {buildingsEnabled && <option value="building">Buildings</option>}
                {maintenanceEnabled && <option value="maintenance">Maintenance logs</option>}
              </select>
            </label>
            <label className="stack">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="card stack">
          <h2>Results</h2>
          {loading && <p className="empty">Searching…</p>}
          {error && <p className="status error">{error}</p>}
          {!loading && !error && term.trim() && results.length === 0 && (
            <p className="empty">Nothing matched “{term}”.</p>
          )}
          {!loading && !error && !term.trim() && (
            <p className="empty">Type a keyword to search across the farm.</p>
          )}
          {!loading && !error && results.length > 0 && (
            <div className="list-rows">
              {results.map((r) => (
                <div
                  key={`${r.type}-${r.id}`}
                  className="list-row clickable"
                  role="link"
                  tabIndex={0}
                  onClick={() => openResult(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openResult(r);
                  }}
                >
                  <div className="row-main">
                    <div className="row-title">{r.title}</div>
                    {r.subtitle && <div className="row-sub">{r.subtitle}</div>}
                  </div>
                  <div className="row-side">
                    <span className="chip">{TYPE_LABEL[r.type]}</span>
                    <span className="row-chevron">›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SearchPage;
