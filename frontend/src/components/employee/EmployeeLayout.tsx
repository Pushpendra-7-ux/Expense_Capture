import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Plus, ReceiptText } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { SwitchRoleLink } from '../ui/SwitchRoleLink';
import { useAppRole } from '../../context/RoleContext';
import { cn } from '../../lib/cn';

const tabs = [
  { to: '/employee', label: 'Expenses', icon: Home, end: true },
  { to: '/employee/no-bill', label: 'No-bill', icon: ReceiptText, end: false },
];

export function EmployeeLayout() {
  const { setRole } = useAppRole();
  const location = useLocation();
  const hideDock = ['/employee/review', '/employee/confirmation'].includes(
    location.pathname
  );

  React.useEffect(() => {
    setRole('employee');
  }, [setRole]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[520px] items-center justify-between px-4">
          <Logo />
          <div className="hidden items-center gap-1 md:flex">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-ink text-cream'
                      : 'text-ink-500 hover:bg-line-soft hover:text-ink'
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
            <NavLink
              to="/employee/snap"
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-ink text-cream'
                    : 'text-ink-500 hover:bg-line-soft hover:text-ink'
                )
              }
            >
              Snap
            </NavLink>
          </div>
          <SwitchRoleLink />
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full max-w-[520px] px-4 pt-5',
          hideDock
            ? 'pb-10'
            : 'pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-12'
        )}
      >
        <Outlet />
      </main>

      {hideDock ? null : (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Employee navigation"
        >
          <div className="mx-auto flex h-[72px] max-w-[520px] items-end justify-around px-6 pb-2">
            {tabs.slice(0, 1).map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 min-w-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors',
                    isActive ? 'text-ink' : 'text-ink-400'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <tab.icon
                      className={cn('h-5 w-5', isActive && 'stroke-[2.4]')}
                    />
                    {tab.label}
                  </>
                )}
              </NavLink>
            ))}

            <NavLink
              to="/employee/snap"
              className="relative -mt-6 flex flex-col items-center gap-1 text-[10px] font-semibold text-ink"
              aria-label="Snap a bill"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream shadow-dock ring-4 ring-paper transition-transform active:scale-95">
                <Plus className="h-6 w-6" />
              </span>
              <span>Snap</span>
            </NavLink>

            {tabs.slice(1).map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 min-w-16 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors',
                    isActive ? 'text-ink' : 'text-ink-400'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <tab.icon
                      className={cn('h-5 w-5', isActive && 'stroke-[2.4]')}
                    />
                    {tab.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
