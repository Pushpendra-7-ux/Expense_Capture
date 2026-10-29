import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

export type AppRole = 'employee' | 'finance';

interface RoleContextValue {
  role: AppRole;
  setRole: (role: AppRole) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'employee',
  setRole: () => {},
});

const STORAGE_KEY = 'ope_active_role';

/**
 * Lightweight role switch for the demo product.
 *
 * There is deliberately no authentication or mock login: the app exposes two
 * workspaces (employee capture + finance review) and remembers the last role on
 * this device. The server remains the source of truth for claim decisions.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<AppRole>('employee');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'finance' || stored === 'employee') {
        setRoleState(stored);
      }
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, []);

  const setRole = useCallback((next: AppRole) => {
    setRoleState(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore.
      }
    }
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAppRole(): RoleContextValue {
  return useContext(RoleContext);
}
