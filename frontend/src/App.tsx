import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import './App.css';
import { supabase } from './lib/supabaseClient';
import { NavDataProvider, useNavData } from './lib/navDataContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Equipment from './pages/Equipment';
import AddMaintenanceLog from './pages/AddMaintenanceLog';
import Account from './pages/Account';
import FarmSetup from './pages/FarmSetup';
import FarmInfo from './pages/FarmInfo';
import SearchPage from './pages/Search';
import Maintenance from './pages/Maintenance';
import MaintenanceLogDetail from './pages/MaintenanceLogDetail';
import EquipmentDetail from './pages/EquipmentDetail';
import Locations from './pages/Locations';
import LocationDetail from './pages/LocationDetail';
import Buildings from './pages/Buildings';
import BuildingDetail from './pages/BuildingDetail';
import AdminTools from './pages/AdminTools';
import Team from './pages/Team';
import Welcome from './pages/Welcome';
import AdminActivity from './pages/AdminActivity';
import RlsAudit from './pages/RlsAudit';

const APP_VERSION = '0.0.8';

function versionStage(version: string): 'Alpha' | 'Beta' | 'Stable' {
  const [majorStr, minorStr] = version.split('.');
  const major = Number(majorStr) || 0;
  const minor = Number(minorStr) || 0;
  if (major === 0 && minor < 1) return 'Alpha';
  if (major === 0 && minor >= 1) return 'Beta';
  return 'Stable';
}

function RequireAuth({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireRole({
  allowed,
  children,
}: {
  allowed: Array<'admin' | 'manager' | 'user'>;
  children: React.ReactNode;
}) {
  const { loading, roleKey } = useNavData();
  if (loading) {
    return <div className="app">Loading...</div>;
  }
  if (!roleKey || !allowed.includes(roleKey)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function VersionBadge() {
  return (
    <Link className="version-badge" to="/dev/rls">
      farmkit v{APP_VERSION} {versionStage(APP_VERSION)}
    </Link>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setAuthReady(true);
      },
    );

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return <div className="app">Loading...</div>;
  }

  return (
    <>
      <BrowserRouter>
        <NavDataProvider session={session}>
          <Routes>
            <Route path="/login" element={<Login session={session} />} />
            <Route path="/welcome" element={<Welcome session={session} />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth session={session}>
                  <Home session={session as Session} />
                </RequireAuth>
              }
            />
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/equipment"
              element={
                <RequireAuth session={session}>
                  {/* session is guaranteed non-null here */}
                  <Equipment session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/equipment/:slug"
              element={
                <RequireAuth session={session}>
                  <EquipmentDetail session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/locations"
              element={
                <RequireAuth session={session}>
                  <Locations session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/locations/:slug"
              element={
                <RequireAuth session={session}>
                  <LocationDetail session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/buildings"
              element={
                <RequireAuth session={session}>
                  <Buildings session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/buildings/:slug"
              element={
                <RequireAuth session={session}>
                  <BuildingDetail session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/maintenance"
              element={
                <RequireAuth session={session}>
                  <Maintenance session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/maintenance/log/:id"
              element={
                <RequireAuth session={session}>
                  <MaintenanceLogDetail session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/maintenance/add"
              element={
                <RequireAuth session={session}>
                  <AddMaintenanceLog session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth session={session}>
                  <Account session={session as Session} />
                </RequireAuth>
              }
            />
          <Route
            path="/farm"
            element={
              <RequireAuth session={session}>
                <FarmInfo session={session as Session} />
              </RequireAuth>
            }
          />
            <Route
              path="/admin/farm"
              element={
                <RequireAuth session={session}>
                  <RequireRole allowed={['admin']}>
                    <FarmSetup session={session as Session} />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/team"
              element={
                <RequireAuth session={session}>
                  <RequireRole allowed={['admin', 'manager']}>
                    <Team session={session as Session} />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route path="/users" element={<Navigate to="/team" replace />} />
            <Route path="/people" element={<Navigate to="/team" replace />} />
            <Route
              path="/admin"
              element={
                <RequireAuth session={session}>
                  <RequireRole allowed={['admin', 'manager']}>
                    <AdminTools session={session as Session} />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/admin/activity"
              element={
                <RequireAuth session={session}>
                  <RequireRole allowed={['admin', 'manager']}>
                    <AdminActivity session={session as Session} />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/dev/rls"
              element={
                <RequireAuth session={session}>
                  <RequireRole allowed={['admin', 'manager']}>
                    <RlsAudit session={session as Session} />
                  </RequireRole>
                </RequireAuth>
              }
            />
            <Route
              path="/search"
              element={
                <RequireAuth session={session}>
                  <SearchPage session={session as Session} />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={<Navigate to={session ? '/dashboard' : '/login'} replace />}
            />
          </Routes>
          <VersionBadge />
        </NavDataProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
