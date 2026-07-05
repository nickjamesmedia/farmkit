import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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

type SearchResult = { id: string; title: string; subtitle: string; slug: string };

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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement | null>(null);

  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);
  const searchEnabled = equipmentEnabled || maintenanceEnabled;
  const adminToolsEnabled = roleKey === 'admin' || roleKey === 'manager';

  useEffect(() => {
    const baseTitle = 'Farmkit';
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
      if (!searchTerm.trim() || !equipmentEnabled) {
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
        .limit(8);
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
        setSearchResults(
          data?.map((row) => {
            const title = row.nickname || row.model || 'Equipment';
            const slug = toSlug(row.nickname?.trim() || row.id);
            return {
              id: row.id,
              title,
              subtitle: [row.category, row.make, row.model]
                .filter(Boolean)
                .join(' · '),
              slug,
            };
          }) ?? [],
        );
      }
    };
    runSearch();
    return () => {
      active = false;
    };
  }, [searchTerm, activeFarmId, dataScopeFarmIds, equipmentEnabled]);

  // close search popover / menu when clicking outside the header
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setSearchTerm('');
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleLogout = async () => {
    setSigningOut(true);
    setSignOutError(null);
    const { error: err } = await supabase.auth.signOut();
    if (err) {
      setSignOutError(err.message);
      setSigningOut(false);
      return;
    }
    setMenuOpen(false);
    navigate('/login', { replace: true });
  };

  const accountName =
    displayName || email || contextEmail || session?.user.email || 'Account';
  const statusError = signOutError || navError;
  const closeMenu = () => setMenuOpen(false);

  const isActive = (to: string) =>
    to === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(to);

  const navLinks = (
    <>
      <Link
        className={`header-link ${isActive('/dashboard') ? 'active' : ''}`}
        to="/dashboard"
      >
        Home
      </Link>
      <ModuleGate moduleKey="equipment">
        <Link
          className={`header-link ${isActive('/equipment') ? 'active' : ''}`}
          to="/equipment"
        >
          Equipment
        </Link>
      </ModuleGate>
      <ModuleGate moduleKey={['containers', 'containers_buildings']}>
        <Link
          className={`header-link ${isActive('/buildings') ? 'active' : ''}`}
          to="/buildings"
        >
          Buildings
        </Link>
      </ModuleGate>
      <ModuleGate moduleKey="maintenance">
        <Link
          className={`header-link ${
            pathname.startsWith('/maintenance') && pathname !== '/maintenance/add'
              ? 'active'
              : ''
          }`}
          to="/maintenance"
        >
          History
        </Link>
      </ModuleGate>
    </>
  );

  const searchBox = (
    <div className="header-search">
      <input
        type="search"
        placeholder="Find equipment…"
        aria-label="Find equipment"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {searchTerm.trim() && (
        <div className="search-popover">
          {searchResults.length === 0 && (
            <div className="search-item" style={{ color: 'var(--muted)' }}>
              No matches
            </div>
          )}
          {searchResults.map((res) => (
            <div
              key={res.id}
              className="search-item"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSearchTerm('');
                setMenuOpen(false);
                navigate(`/equipment/${res.slug}`);
              }}
            >
              <div style={{ fontWeight: 600 }}>{res.title}</div>
              {res.subtitle && <div className="row-sub">{res.subtitle}</div>}
            </div>
          ))}
          {searchEnabled && (
            <div className="search-more">
              <Link
                to={`/search?term=${encodeURIComponent(searchTerm)}`}
                onClick={() => {
                  setSearchTerm('');
                  setMenuOpen(false);
                }}
              >
                All results →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <header className="app-header" ref={headerRef}>
      <div className="header-inner">
        <Link to="/dashboard" className="brand">
          {farmLogo && <img src={farmLogo} alt="" />}
          {farmName || (navLoading ? '…' : 'Farmkit')}
        </Link>

        <nav className="header-links" aria-label="Main">
          {navLinks}
        </nav>

        <div className="header-actions">
          {searchBox}
          <ModuleGate moduleKey="maintenance">
            <Link className="btn" to="/maintenance/add">
              + Add Log
            </Link>
          </ModuleGate>
          <Link
            className="header-link header-account"
            to="/account"
            title={accountName}
          >
            {accountName.length > 18
              ? `${accountName.slice(0, 16)}…`
              : accountName}
          </Link>
          <button
            className="mobile-toggle"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            type="button"
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {statusError && (
        <p className="status error" style={{ margin: '0 0 0.6rem' }}>
          {statusError}
        </p>
      )}

      {menuOpen && (
        <div className="menu-backdrop" onClick={closeMenu}>
          <div
            className="menu-sheet"
            role="dialog"
            aria-label="Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div className="menu-meta">
                Signed in as <strong>{accountName}</strong>
                {farmName ? ` — ${farmName}` : ''}
              </div>
              <button
                type="button"
                className="secondary small"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                ✕ Close
              </button>
            </div>
            <div className="menu-divider" />
            <Link className="menu-item" to="/dashboard" onClick={closeMenu}>
              Home
            </Link>
            {equipmentEnabled && (
              <Link className="menu-item" to="/equipment" onClick={closeMenu}>
                Equipment
              </Link>
            )}
            {buildingsEnabled && (
              <Link className="menu-item" to="/buildings" onClick={closeMenu}>
                Buildings
              </Link>
            )}
            {maintenanceEnabled && (
              <Link className="menu-item" to="/maintenance" onClick={closeMenu}>
                Maintenance History
              </Link>
            )}
            {searchEnabled && (
              <Link className="menu-item" to="/search" onClick={closeMenu}>
                Search
              </Link>
            )}
            <Link className="menu-item" to="/locations" onClick={closeMenu}>
              Locations
            </Link>
            <Link className="menu-item" to="/farm" onClick={closeMenu}>
              Farm Info
            </Link>
            <div className="menu-divider" />
            <Link className="menu-item" to="/account" onClick={closeMenu}>
              My Account
            </Link>
            {adminToolsEnabled && (
              <Link className="menu-item" to="/team" onClick={closeMenu}>
                Team
              </Link>
            )}
            {adminToolsEnabled && (
              <Link className="menu-item" to="/admin" onClick={closeMenu}>
                Admin Tools
              </Link>
            )}
            <div className="menu-divider" />
            {maintenanceEnabled && (
              <Link className="btn" to="/maintenance/add" onClick={closeMenu}>
                + Add Maintenance Log
              </Link>
            )}
            <button
              type="button"
              className="secondary"
              onClick={handleLogout}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Nav;
