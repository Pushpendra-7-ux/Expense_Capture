import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AppRole = 'employee' | 'finance';

interface RoleContextValue {
  role: AppRole | null;
  setRole: (role: AppRole) => void;
  clearRole: () => void;
}

const STORAGE_KEY = 'ope_web_role';
const RoleContext = createContext<RoleContextValue | null>(null);

function readStoredRole(): AppRole | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'employee' || stored === 'finance' ? stored : null;
  } catch {
    return null;
  }
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole | null>(readStoredRole);

  const setRole = useCallback((next: AppRole) => {
    setRoleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  const value = useMemo(
    () => ({ role, setRole, clearRole }),
    [role, setRole, clearRole]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAppRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useAppRole must be used inside RoleProvider');
  }
  return context;
}
