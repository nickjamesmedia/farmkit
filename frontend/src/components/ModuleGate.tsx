import type { ReactNode } from 'react';
import { useNavData } from '../lib/navDataContext';

type Props = {
  moduleKey: string | string[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function ModuleGate({
  moduleKey,
  requireAll = true,
  children,
  fallback = null,
}: Props) {
  const { loading, moduleEnabledByKey } = useNavData();

  // Avoid UI flashes while loading nav/module state.
  if (loading) return <>{children}</>;

  const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];
  const resolved = keys.map((key) => moduleEnabledByKey[key]);

  // Missing key => treat as enabled (server-side RLS is the authority).
  const isEnabled = requireAll
    ? resolved.every((value) => value ?? true)
    : resolved.some((value) => value ?? true);

  if (!isEnabled) return <>{fallback}</>;
  return <>{children}</>;
}

