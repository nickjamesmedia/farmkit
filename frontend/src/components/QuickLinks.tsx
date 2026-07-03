import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavData } from '../lib/navDataContext';

type QuickLink = {
  label: string;
  to: string;
};

export default function QuickLinks() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { moduleEnabledByKey, loading: navLoading } = useNavData();

  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);
  const searchEnabled = equipmentEnabled || maintenanceEnabled;

  const links = useMemo(() => {
    const items: QuickLink[] = [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Locations', to: '/locations' },
      { label: 'Farm Info', to: '/farm' },
    ];

    if (equipmentEnabled) items.splice(1, 0, { label: 'Equipment', to: '/equipment' });
    if (buildingsEnabled) items.splice(1, 0, { label: 'Buildings', to: '/buildings' });
    if (maintenanceEnabled) items.push({ label: 'Maintenance', to: '/maintenance' });
    if (maintenanceEnabled) items.push({ label: 'Add Log', to: '/maintenance/add' });
    if (searchEnabled) items.push({ label: 'Search', to: '/search' });

    // Never show admin-only pages in quick links.

    // Hide the current page if it matches a quick link.
    return items.filter((item) => item.to !== pathname);
  }, [buildingsEnabled, equipmentEnabled, maintenanceEnabled, pathname, searchEnabled]);

  if (navLoading) {
    return null;
  }

  if (links.length === 0) {
    return null;
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <strong>Quick Links</strong>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {links.map((item) => (
            <Link key={item.to} className="nav-btn" to={item.to}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)' }}
          >
            <div className="stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Quick Links</h2>
                <button
                  type="button"
                  style={{ background: '#ccc', color: '#000' }}
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                }}
              >
                {links.map((item) => (
                  <Link
                    key={item.to}
                    className="nav-btn"
                    to={item.to}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

