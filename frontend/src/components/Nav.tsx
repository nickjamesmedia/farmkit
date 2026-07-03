import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { useNavData } from '../lib/navDataContext';
import { toSlug } from '../utils/slug';
import ModuleGate from './ModuleGate';

type NavProps = {
  session?: Session;
  email?: string;
  pageTitle?: string;
};

function Nav({ session, email, pageTitle }: NavProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const {
    loading: navLoading,
    error: navError,
    displayName,
    farmName,
    farmFavicon,
    farmLogo,
    activeFarmId,
    dataScopeFarmIds,
    moduleEnabledByKey,
    roleKey,
    email: contextEmail,
  } = useNavData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string; subtitle: string; slug: string }[]
  >([]);
  const navigate = useNavigate();

  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);
  const searchEnabled = equipmentEnabled || maintenanceEnabled;
  const adminToolsEnabled = roleKey === 'admin' || roleKey === 'manager';

  useEffect(() => {
    const baseTitle = 'farmkit';
    const farm = farmName ? `${farmName} | ` : '';
    const page = pageTitle ? `${pageTitle} | ` : '';
    document.title = `${page}${farm}${baseTitle}`;
  }, [farmName, pageTitle]);

  useEffect(() => {
    if (!farmFavicon) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = farmFavicon;
  }, [farmFavicon]);

  useEffect(() => {
    let active = true;
    const runSearch = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }
      if (!equipmentEnabled) {
        setSearchResults([]);
        return;
      }
      let query = supabase
        .from('equipment')
        .select('id, nickname, unit_number, category, make, model')
        .or(
          `nickname.ilike.%${searchTerm}%,unit_number.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,make.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`,
        )
        .order('nickname', { ascending: true })
        .limit(10);
      if (dataScopeFarmIds.length > 0) {
        query = query.in('farm_id', dataScopeFarmIds);
      } else if (activeFarmId) {
        query = query.eq('farm_id', activeFarmId);
      }
      const { data, error } = await query;
      if (!active) return;
      if (error) {
        setSearchResults([]);
      } else {
        const mapped =
          data?.map((row) => {
            const title = row.nickname || row.model || 'Equipment';
            const base = row.nickname?.trim() || row.id;
            const slug = toSlug(base);
            return {
              id: row.id,
              title,
              subtitle: [row.category, row.make, row.model, row.unit_number ? `Unit ${row.unit_number}` : null]
                .filter(Boolean)
                .join(' | '),
              slug,
            };
          }) ?? [];
        setSearchResults(mapped);
      }
    };
    runSearch();
    return () => {
      active = false;
    };
  }, [searchTerm, activeFarmId, dataScopeFarmIds, equipmentEnabled]);

  const handleLogout = async () => {
    setSigningOut(true);
    setSignOutError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setSignOutError(signOutError.message);
      setSigningOut(false);
      return;
    }
    setMenuOpen(false);
    navigate('/login', { replace: true });
  };

  const welcomeText =
    displayName || email || contextEmail || session?.user.email || '';
  const displayLink = <Link to="/account">Set display name</Link>;
  const displayNode =
    navLoading && !welcomeText ? (
      <span>Loading...</span>
    ) : welcomeText ? (
      <Link to="/account">
        <strong>{welcomeText}</strong>
      </Link>
    ) : (
      displayLink
    );
  const farmLink =
    roleKey === 'admin' ? (
      <Link to="/admin/farm">Set farm name</Link>
    ) : (
      <Link to="/farm">Farm Info</Link>
    );
  const farmNode = farmName ? farmName : navLoading ? 'Loading farm...' : farmLink;
  const statusError = signOutError || navError;

  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => setMenuOpen((v) => !v);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const nav = document.querySelector('nav');
      if (nav && !nav.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  return (
    <nav className="card stack nav-card" style={{ marginBottom: '1rem', position: 'relative', gap: '0.6rem' }}>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {farmLogo && (
            <Link to="/farm" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <img
                src={farmLogo}
                alt="Farm logo"
                style={{
                  height: '36px',
                  width: 'auto',
                  objectFit: 'contain',
                  cursor: 'pointer',
                }}
              />
            </Link>
          )}
          <Link to="/farm" style={{ fontWeight: 700, fontSize: '1rem' }}>
            {farmNode}
          </Link>
        </div>
        <button
          className="mobile-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          type="button"
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
         <div className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
           <Link className="nav-btn" to="/dashboard" onClick={closeMenu}>
             Dashboard
           </Link>
           <ModuleGate moduleKey="equipment">
             <Link className="nav-btn" to="/equipment" onClick={closeMenu}>
               Equipment
             </Link>
           </ModuleGate>
           <ModuleGate moduleKey={['containers', 'containers_buildings']}>
             <Link className="nav-btn" to="/buildings" onClick={closeMenu}>
               Buildings
             </Link>
           </ModuleGate>
           <Link className="nav-btn" to="/locations" onClick={closeMenu}>
             Locations
           </Link>
           <ModuleGate moduleKey="maintenance">
             <Link className="nav-btn primary" to="/maintenance/add" onClick={closeMenu}>
               Add Log
             </Link>
           </ModuleGate>
         </div>
       </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '0.95rem' }}>Welcome {displayNode}</div>
          <div style={{ fontSize: '0.9rem' }}>
            <Link to="/account">Account</Link>
            {' | '}
            <button
              type="button"
              onClick={async () => {
                await handleLogout();
                closeMenu();
              }}
              disabled={signingOut}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#0f172a',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {signingOut ? 'Signing out...' : 'Logout'}
            </button>
            {adminToolsEnabled && (
              <>
                {' | '}
                <Link to="/admin">Admin Tools</Link>
              </>
            )}
          </div>
        </div>
        <div
          className="stack"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setMenuOpen(false)}
              style={{ width: '100%' }}
            />
            {searchTerm.trim() && (
              <div className="search-popover">
                {searchResults.length === 0 && (
                  <div className="search-item" style={{ color: '#475569' }}>
                    No matches
                  </div>
                )}
                {searchResults.map((res) => (
                  <div
                    key={res.id}
                    className="search-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/equipment/${res.slug}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 700 }}>{res.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                      {res.subtitle}
                    </div>
                  </div>
                ))}
                <div className="search-more">
                  <Link to={`/search?term=${encodeURIComponent(searchTerm)}`}>
                    View more results
                  </Link>
                </div>
              </div>
            )}
          </div>
          {searchEnabled && <Link to="/search">Advanced</Link>}
        </div>
      </div>
      {statusError && <p className="status">{statusError}</p>}
      {menuOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            closeMenu();
          }}
          style={{ zIndex: 1200 }}
        >
          <div
            className="modal"
            style={{ width: 'min(340px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stack">
              <Link className="nav-btn" to="/dashboard" onClick={closeMenu}>
                Dashboard
              </Link>
              {equipmentEnabled && (
                <Link className="nav-btn" to="/equipment" onClick={closeMenu}>
                  Equipment
                </Link>
              )}
              {buildingsEnabled && (
                <Link className="nav-btn" to="/buildings" onClick={closeMenu}>
                  Buildings
                </Link>
              )}
              <Link className="nav-btn" to="/locations" onClick={closeMenu}>
                Locations
              </Link>
              {maintenanceEnabled && (
                <Link className="nav-btn primary" to="/maintenance/add" onClick={closeMenu}>
                  Add Log
                </Link>
              )}
              {searchEnabled && (
                <Link className="nav-btn" to="/search" onClick={closeMenu}>
                  Advanced Search
                </Link>
              )}
              <Link className="nav-btn" to="/account" onClick={closeMenu}>
                Account
              </Link>
              {adminToolsEnabled && (
                <Link className="nav-btn" to="/admin" onClick={closeMenu}>
                  Admin Tools
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  await handleLogout();
                  closeMenu();
                }}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Logout'}
              </button>
              <button
                type="button"
                style={{ background: '#ccc', color: '#000' }}
                onClick={closeMenu}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Nav;
