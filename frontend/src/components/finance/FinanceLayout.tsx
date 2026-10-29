import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, ChevronRight, Menu, ReceiptText } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { SwitchRoleLink } from '../ui/SwitchRoleLink';
import { Drawer } from '../ui/Drawer';
import { useAppRole } from '../../context/RoleContext';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/finance', label: 'Claims', icon: ReceiptText, end: true },
  { to: '/finance/analytics', label: 'Analytics', icon: BarChart3, end: false },
];

interface NavProps {
  onNavigate?: () => void;
}

function pageLabel(pathname: string): string {
  if (pathname === '/finance/analytics') return 'Analytics';
  if (pathname.startsWith('/finance/claims/')) return 'Claim detail';
  return 'Claims';
}

function FinanceProfile() {
  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[10px] font-bold text-amber-300">
        FT
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-cream">Finance Team</p>
        <p className="truncate text-[9px] text-cream/40">OPE ledger</p>
      </div>
    </div>
  );
}

function FinanceNav({ onNavigate }: NavProps) {
  return (
    <nav className="space-y-1" aria-label="Finance navigation">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-white/10 text-cream'
                : 'text-cream/60 hover:bg-white/[0.06] hover:text-cream'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn('h-4 w-4', isActive ? 'text-amber-300' : 'text-cream/40')}
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function FinanceLayout() {
  const { setRole } = useAppRole();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setRole('finance');
  }, [setRole]);

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-ink lg:flex">
        <div className="px-5 pb-6 pt-5">
          <Logo dark />
        </div>
        <div className="flex-1 px-3">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-cream/35">
            Finance
          </p>
          <FinanceNav />
        </div>
        <div className="border-t border-white/10 p-3">
          <FinanceProfile />
          <SwitchRoleLink dark className="w-full" />
        </div>
      </aside>

      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="lg:hidden">
                <Logo />
              </div>
              <span className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] lg:flex">
                <span className="text-ink-400">Finance</span>
                <ChevronRight className="h-3 w-3 text-ink-300" />
                <span className="text-ink">{pageLabel(pathname)}</span>
              </span>
            </div>
            <SwitchRoleLink />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Finance">
        <div className="flex min-h-full flex-col">
          <div className="flex-1 p-3">
            <FinanceNav onNavigate={() => setDrawerOpen(false)} />
          </div>
          <div className="border-t border-white/10 p-3">
            <FinanceProfile />
            <SwitchRoleLink dark className="w-full" />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
