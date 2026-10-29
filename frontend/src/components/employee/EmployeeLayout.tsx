import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Camera,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  ReceiptText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { SwitchRoleLink } from '../ui/SwitchRoleLink';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAppRole } from '../../context/RoleContext';
import { EMPLOYEE_NAME, EMPLOYEE_ROLE } from '../../lib/api';
import { cn } from '../../lib/cn';

const workspaceNav = [
  { to: '/employee', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/employee/analytics', label: 'Analytics', icon: BarChart3, end: false },
];

const captureNav = [
  { to: '/employee/snap', label: 'Snap a bill', icon: Camera, end: false },
  { to: '/employee/no-bill', label: 'No-bill', icon: ReceiptText, end: false },
];

const headerTabs = [
  { to: '/employee', label: 'Overview', end: true },
  { to: '/employee/analytics', label: 'Analytics', end: false },
  { to: '/employee/snap', label: 'Snap', end: false },
  { to: '/employee/no-bill', label: 'No-bill', end: false },
];

const helpSteps = [
  {
    title: 'Capture an expense',
    description:
      'Add up to three receipt photos or start a no-bill claim. AI fills the details and you confirm them.',
  },
  {
    title: 'Finance reviews',
    description:
      'Every claim reaches Finance with its receipt and business purpose. They approve, reject, or ask for more information.',
  },
  {
    title: 'Follow the decision',
    description:
      'Open any claim to see its status, review note, and submitted details in one place.',
  },
];

function pageLabel(pathname: string): string {
  if (pathname === '/employee/analytics') return 'Analytics';
  if (pathname === '/employee/snap') return 'Snap a bill';
  if (pathname === '/employee/no-bill') return 'No-bill claim';
  if (pathname === '/employee/review') return 'Review claim';
  if (pathname === '/employee/confirmation') return 'Confirmation';
  if (pathname.startsWith('/employee/expenses/')) return 'Claim detail';
  return 'Overview';
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
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
  );
}

function DockLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors',
          isActive ? 'text-ink' : 'text-ink-400'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.4]')} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function EmployeeProfile() {
  const initials = EMPLOYEE_NAME.split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-[10px] font-bold text-amber-300">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-cream">
          {EMPLOYEE_NAME}
        </p>
        <p className="truncate text-[9px] text-cream/40">{EMPLOYEE_ROLE}</p>
      </div>
    </div>
  );
}

export function EmployeeLayout() {
  const { setRole } = useAppRole();
  const { pathname } = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const hideDock = ['/employee/review', '/employee/confirmation'].includes(pathname);
  const isWide = pathname === '/employee' || pathname === '/employee/analytics';

  useEffect(() => {
    setRole('employee');
  }, [setRole]);

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-hidden bg-ink lg:flex">
        <div className="pointer-events-none absolute -left-16 top-20 h-48 w-48 rounded-full bg-amber-400/[0.07] blur-2xl" />
        <div className="relative px-5 pb-5 pt-5">
          <Logo dark />
        </div>

        <div className="relative flex flex-1 flex-col overflow-y-auto px-3 pb-4">
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-300">
                <ReceiptText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-cream">
                  Dexter Capital
                </p>
                <p className="truncate text-[9px] text-cream/40">
                  Expense workspace
                </p>
              </div>
            </div>
          </div>

          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-cream/35">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Employee workspace">
            {workspaceNav.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </nav>

          <p className="mb-2 mt-5 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-cream/35">
            Capture
          </p>
          <nav className="space-y-1" aria-label="Capture an expense">
            {captureNav.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 pt-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="mt-3 text-xs font-semibold text-cream">
              Small effort. Big clarity.
            </p>
            <p className="mt-1 text-[10px] leading-4 text-cream/45">
              Capture it now. Thank yourself later.
            </p>
            <NavLink
              to="/employee/snap"
              className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300 transition-colors hover:text-amber-200"
            >
              Add an expense
              <ArrowUpRight className="h-3.5 w-3.5" />
            </NavLink>
          </div>
        </div>

        <div className="relative shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="mb-2 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[11px] font-semibold text-cream/60 transition-colors hover:bg-white/[0.06] hover:text-cream"
          >
            <HelpCircle className="h-4 w-4 text-cream/40" />
            Help &amp; getting started
          </button>
          <EmployeeProfile />
          <SwitchRoleLink dark className="mt-1 w-full" />
        </div>
      </aside>

      <div className="min-w-0 lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[520px] items-center justify-between gap-3 px-4 md:max-w-[1400px] md:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <Logo />
              </div>
              <div className="hidden items-center gap-1 md:flex lg:hidden">
                {headerTabs.map((tab) => (
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
              </div>
              <span className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] lg:flex">
                <span className="text-ink-400">Workspace</span>
                <ChevronRight className="h-3 w-3 text-ink-300" />
                <span className="text-ink">{pageLabel(pathname)}</span>
              </span>
            </div>
            <SwitchRoleLink />
          </div>
        </header>

        <main
          className={cn(
            'mx-auto w-full px-4 pt-5 md:px-6 lg:px-8 lg:py-7',
            isWide
              ? 'max-w-[520px] md:max-w-[1200px] xl:max-w-[1400px]'
              : 'max-w-[520px] md:max-w-[640px]',
            hideDock
              ? 'pb-10'
              : 'pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-12'
          )}
        >
          <Outlet />
        </main>
      </div>

      {hideDock ? null : (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Employee navigation"
        >
          <div className="mx-auto flex h-[72px] max-w-[520px] items-end justify-around px-4 pb-2">
            <DockLink to="/employee" label="Expenses" icon={LayoutDashboard} end />
            <DockLink
              to="/employee/analytics"
              label="Analytics"
              icon={BarChart3}
            />

            <DockLink to="/employee/no-bill" label="No-bill" icon={ReceiptText} />
          </div>
        </nav>
      )}

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="A simpler way to manage expenses"
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setHelpOpen(false)}>
            Got it
          </Button>
        }
      >
        <div className="space-y-4">
          {helpSteps.map((step, index) => (
            <div key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-[11px] font-bold text-amber-600">
                {index + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 text-[11px] leading-5 text-ink-500">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-line-soft bg-cream px-3.5 py-3 text-[11px] leading-5 text-ink-500">
            You are using a local demo with sample records. Changes persist in
            the local database.
          </div>
        </div>
      </Modal>
    </div>
  );
}
