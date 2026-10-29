import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, UserRound } from 'lucide-react';
import { useAppRole } from '../../context/RoleContext';
import { Logo } from '../../components/ui/Logo';

const roles = [
  {
    role: 'employee' as const,
    to: '/employee',
    title: 'Employee',
    line: 'Snap a bill. Submit the claim.',
    icon: UserRound,
  },
  {
    role: 'finance' as const,
    to: '/finance',
    title: 'Finance Team',
    line: 'Review claims and payments.',
    icon: ShieldCheck,
  },
];

export function RoleSelectPage() {
  const { setRole } = useAppRole();

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>

        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">
            Out-of-pocket expenses
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
            Choose your workspace
          </h1>
          <p className="mt-1.5 text-sm text-ink-400">No sign-in needed.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map(({ role, to, title, line, icon: Icon }) => (
            <Link
              key={role}
              to={to}
              onClick={() => setRole(role)}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift active:translate-y-0"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-cream">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-ink">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-400">
                  {line}
                </span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-400 transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-cream">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
          Dexter Capital · OPE
        </p>
      </div>
    </div>
  );
}
