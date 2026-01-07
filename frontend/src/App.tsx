import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import './App.css';
import { supabase } from './lib/supabaseClient';
import Login from './pages/Login';
import Home from './pages/Home';
import Equipment from './pages/Equipment';
import AddMaintenanceLog from './pages/AddMaintenanceLog';
import Account from './pages/Account';
import FarmSetup from './pages/FarmSetup';
import ManageUsers from './pages/ManageUsers';
import SearchPage from './pages/Search';
import EquipmentDetail from './pages/EquipmentDetail';
import Locations from './pages/Locations';
import LocationDetail from './pages/LocationDetail';
import Buildings from './pages/Buildings';
import BuildingDetail from './pages/BuildingDetail';
import AdminTools from './pages/AdminTools';
import AdminActivity from './pages/AdminActivity';

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
        <Routes>
          <Route path="/login" element={<Login session={session} />} />
          <Route
            path="/app"
            element={
              <RequireAuth session={session}>
                <Home session={session as Session} />
              </RequireAuth>
            }
          />
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
                <FarmSetup session={session as Session} />
              </RequireAuth>
            }
          />
        <Route
          path="/users"
          element={
            <RequireAuth session={session}>
              <ManageUsers session={session as Session} />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth session={session}>
              <AdminTools session={session as Session} />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <RequireAuth session={session}>
              <AdminActivity session={session as Session} />
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
          element={<Navigate to={session ? '/app' : '/login'} replace />}
        />
        </Routes>
      </BrowserRouter>
      <div className="version-badge">
        Farm Kit v{APP_VERSION} {versionStage(APP_VERSION)}
      </div>
    </>
  );
}

export default App;
