import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  ChevronRight,
  ReceiptText,
} from 'lucide-react';
import {
  CATEGORY_FILTERS,
  fetchExpenses,
  type ExpenseRecord,
} from '../../lib/api';
import {
  formatDate,
  formatINR,
  formatMonth,
  isSameMonth,
  parseExpenseDate,
  parseTimestamp,
} from '../../lib/format';
import { useReloadOnFocus } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { cn } from '../../lib/cn';

export function EmployeeFeedPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const response = await fetchExpenses(null, 50);
      setExpenses(response.items);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useReloadOnFocus(load);

  const currentMonth = useMemo(
    () => expenses.filter((item) => isSameMonth(parseExpenseDate(item.expense_date))),
    [expenses]
  );
  const monthTotal = currentMonth.reduce((sum, item) => sum + item.amount_minor, 0);
  const pendingCount = currentMonth.filter(
    (item) => item.review_status === 'submitted' || item.review_status === 'under_review'
  ).length;

  const activeFilter = CATEGORY_FILTERS.find((item) => item.key === filter);
  const visible = useMemo(() => {
    if (!activeFilter?.categories) return expenses;
    return expenses.filter((item) => activeFilter.categories?.includes(item.category));
  }, [expenses, activeFilter]);

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-600">
          {formatMonth(new Date())}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-[-0.02em] text-ink">
          Expenses
        </h1>
      </div>

      <Card tone="dark" padding="md" className="relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cream/50">
              This month
            </p>
            <p className="mt-1.5 text-3xl font-bold tracking-[-0.03em] text-cream">
              {formatINR(monthTotal)}
            </p>
            <p className="mt-1 text-xs text-cream/60">
              {currentMonth.length} {currentMonth.length === 1 ? 'claim' : 'claims'}
              {pendingCount > 0 ? ` · ${pendingCount} in review` : ''}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-amber-300">
            <ReceiptText className="h-5 w-5" />
          </span>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/employee/snap"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cream text-xs font-bold text-ink transition-colors hover:bg-white"
          >
            <Camera className="h-4 w-4" />
            Snap a bill
          </Link>
          <Link
            to="/employee/no-bill"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 text-xs font-bold text-cream transition-colors hover:bg-white/10"
          >
            No bill
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">
            Filter
          </p>
          {activeFilter && activeFilter.key !== 'all' ? (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-[10px] font-semibold text-ink-400 hover:text-ink"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 pb-1">
          {CATEGORY_FILTERS.map((item) => (
            <Chip
              key={item.key}
              selected={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">
            Recent activity
          </p>
          <span className="text-[10px] font-medium text-ink-400">
            {visible.length} {visible.length === 1 ? 'claim' : 'claims'}
          </span>
        </div>

        {loading ? (
          <LoadingState label="Loading expenses…" />
        ) : error ? (
          <ErrorState
            title="Couldn’t load expenses"
            message={error}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={filter === 'all' ? 'No expenses yet' : 'Nothing in this category'}
            description={
              filter === 'all'
                ? 'Snap your first bill to start the ledger.'
                : 'Try another filter.'
            }
            action={
              <Link to="/employee/snap">
                <Button size="sm">Snap a bill</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            {visible.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense }: { expense: ExpenseRecord }) {
  const submitted = parseTimestamp(expense.created_at);
  return (
    <Link
      to={`/employee/expenses/${expense.reference_id}`}
      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-cream/60"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-ink-500',
          expense.review_status === 'approved' && 'bg-success-50 text-success-600',
          expense.review_status === 'rejected' && 'bg-danger-50 text-danger-600'
        )}
      >
        <CategoryIcon category={expense.category} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {expense.merchant || 'Expense'}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-ink-400">
          {formatDate(submitted)} · {expense.reference_id}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-bold tabular-nums text-ink">
          {formatINR(expense.amount_minor)}
        </p>
        <StatusBadge status={expense.review_status} />
      </div>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-400 sm:block" />
    </Link>
  );
}
