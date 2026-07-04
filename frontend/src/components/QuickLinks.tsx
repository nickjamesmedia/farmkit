import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavData } from '../lib/navDataContext';

type QuickLink = {
  label: string;
  to: string;
};

export default function QuickLinks() {
  const { pathname } = useLocation();
  const { moduleEnabledByKey, loading: navLoading } = useNavData();

  const equipmentEnabled = moduleEnabledByKey.equipment ?? true;
  const maintenanceEnabled = moduleEnabledByKey.maintenance ?? true;
  const buildingsEnabled =
    (moduleEnabledByKey.containers ?? true) &&
    (moduleEnabledByKey.containers_buildings ?? true);

  const links = useMemo(() => {
    const items: QuickLink[] = [{ label: 'Home', to: '/dashboard' }];
    if (equipmentEnabled) items.push({ label: 'Equipment', to: '/equipment' });
    if (buildingsEnabled) items.push({ label: 'Buildings', to: '/buildings' });
    if (maintenanceEnabled) items.push({ label: 'History', to: '/maintenance' });
    if (maintenanceEnabled) items.push({ label: '+ Add Log', to: '/maintenance/add' });
    return items.filter((item) => item.to !== pathname);
  }, [buildingsEnabled, equipmentEnabled, maintenanceEnabled, pathname]);

  if (navLoading || links.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {links.map((item) => (
        <Link
          key={item.to}
          className={`nav-btn ${item.to === '/maintenance/add' ? 'primary' : ''}`}
          to={item.to}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
