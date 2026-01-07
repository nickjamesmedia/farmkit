import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { toSlug } from '../utils/slug';

type NavProps = {
  session?: Session;
  email?: string;
  pageTitle?: string;
};

function Nav({ session, email, pageTitle }: NavProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [farmName, setFarmName] = useState<string | null>(null);
  const [farmFavicon, setFarmFavicon] = useState<string | null>(null);
  const [farmLogo, setFarmLogo] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string; subtitle: string; slug: string }[]
  >([]);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!session?.user) return;
      const [{ data: profile }, { data: farm }] = await Promise.all([
        supabase
          .from('app_users')
          .select('name')
          .eq('auth_user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('farms')
          .select('name, favicon_url, logo_url')
          .order('created_at')
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      setDisplayName(profile?.name ?? null);
      setFarmName(farm?.name ?? null);
      setFarmFavicon(farm?.favicon_url ?? null);
      setFarmLogo(farm?.logo_url ?? null);
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [session?.user]);

  useEffect(() => {
    const baseTitle = 'Farm Kit';
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
      const { data, error } = await supabase
        .from('equipment')
        .select('id, nickname, unit_number, category, make, model')
        .or(
          `nickname.ilike.%${searchTerm}%,unit_number.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,make.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`,
        )
        .order('nickname', { ascending: true })
        .limit(10);
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
  }, [searchTerm]);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setLoading(false);
      return;
    }
    setMenuOpen(false);
    navigate('/login', { replace: true });
  };

  const welcomeText = displayName || email || session?.user.email || '';
  const displayLink = <Link to="/account">Set display name</Link>;
  const farmLink = <Link to="/farm">Set farm name</Link>;
  const displayNode = welcomeText ? <strong>{welcomeText}</strong> : displayLink;

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
            <Link to="/app" style={{ display: 'inline-flex', alignItems: 'center' }}>
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
          <Link to="/app" style={{ fontWeight: 700, fontSize: '1rem' }}>
            {farmName || farmLink}
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
          <Link className="nav-btn" to="/app" onClick={closeMenu}>
            Home
          </Link>
          <Link className="nav-btn" to="/equipment" onClick={closeMenu}>
            Equipment
          </Link>
          <Link className="nav-btn" to="/locations" onClick={closeMenu}>
            Locations
          </Link>
          <Link className="nav-btn" to="/buildings" onClick={closeMenu}>
            Buildings
          </Link>
          <Link className="nav-btn primary" to="/maintenance/add" onClick={closeMenu}>
            Add Log
          </Link>
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
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#0f172a',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Signing out...' : 'Logout'}
            </button>
            {' | '}
            <Link to="/admin">Admin Tools</Link>
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
          <Link to="/search">Advanced</Link>
        </div>
      </div>
      {error && <p className="status">{error}</p>}
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
              <Link className="nav-btn" to="/app" onClick={closeMenu}>
                Home
              </Link>
              <Link className="nav-btn" to="/equipment" onClick={closeMenu}>
                Equipment
              </Link>
              <Link className="nav-btn" to="/locations" onClick={closeMenu}>
                Locations
              </Link>
              <Link className="nav-btn" to="/buildings" onClick={closeMenu}>
                Buildings
              </Link>
              <Link className="nav-btn primary" to="/maintenance/add" onClick={closeMenu}>
                Add Log
              </Link>
              <Link className="nav-btn" to="/search" onClick={closeMenu}>
                Advanced Search
              </Link>
              <Link className="nav-btn" to="/account" onClick={closeMenu}>
                Account
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await handleLogout();
                  closeMenu();
                }}
                disabled={loading}
              >
                {loading ? 'Signing out...' : 'Logout'}
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
