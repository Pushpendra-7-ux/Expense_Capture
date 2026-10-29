import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Paperclip,
  ReceiptText,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  CATEGORY_FILTERS,
  EMPLOYEE_NAME,
  fetchAllExpenses,
  getCategoryOption,
  type ExpenseRecord,
  type ReviewStatus,
} from '../../lib/api';
import {
  cumulativeMonthSpend,
  employeeCategorySpend,
  employeeKpis,
} from '../../lib/analytics';
import {
  formatDate,
  formatINR,
  formatMonth,
  isSameMonth,
  parseExpenseDate,
  parseTimestamp,
} from '../../lib/format';
import { useMediaQuery, useReloadOnFocus } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Input, Select } from '../../components/ui/Input';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui/States';
import { EmployeeKpiCard } from '../../components/employee/EmployeeKpiCard';
import { EmployeeChartTooltip } from '../../components/employee/EmployeeChartTooltip';
import { cn } from '../../lib/cn';

type StatusFilter = 'all' | ReviewStatus;
type StatusCounts = Record<StatusFilter, number>;

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All expenses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const axisTick = { fontSize: 10, fill: '#6D6D78' };

function axisCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function rowTileTone(status: ReviewStatus): string {
  if (status === 'approved') return 'bg-success-50 text-success-600';
  if (status === 'rejected') return 'bg-danger-50 text-danger-600';
  if (status === 'under_review') return 'bg-amber-50 text-amber-600';
  return 'bg-info-50 text-info-500';
}

function SpendingOverviewCard({ expenses }: { expenses: ExpenseRecord[] }) {
  const data = useMemo(() => cumulativeMonthSpend(expenses), [expenses]);
  const total = data.length ? data[data.length - 1].cumulative : 0;
  const hasSpend = data.some((item) => item.cumulative > 0);

  return (
    <Card padding="md" className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Spending overview</p>
          <p className="mt-0.5 text-[10px] text-ink-400">
            A clearer picture of this month’s claims
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tracking-[-0.02em] text-ink">
            {formatINR(total * 100)}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            cumulative
          </p>
        </div>
      </div>

      {hasSpend ? (
        <div className="mt-5 h-[244px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 9, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient
                  id="employeeSpendFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#C58A2A" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#C58A2A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#EFEBE2"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="label"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                width={52}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisCurrency}
              />
              <Tooltip
                content={<EmployeeChartTooltip valueLabel="Cumulative claimed" />}
                cursor={{ stroke: '#D6CEBE', strokeDasharray: '4 4' }}
              />
              <Area
                type="stepAfter"
                dataKey="cumulative"
                stroke="#C58A2A"
                strokeWidth={2.4}
                fill="url(#employeeSpendFill)"
                dot={false}
                isAnimationActive={false}
                activeDot={{
                  r: 5,
                  fill: '#C58A2A',
                  stroke: '#FBF9F4',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-5 flex h-[244px] items-center justify-center rounded-xl border border-dashed border-line bg-cream/60">
          <div className="text-center">
            <ReceiptText className="mx-auto h-5 w-5 text-ink-300" />
            <p className="mt-2 text-xs text-ink-400">
              No claims this month yet.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function CategoryBreakdownCard({ expenses }: { expenses: ExpenseRecord[] }) {
  const data = useMemo(() => employeeCategorySpend(expenses), [expenses]);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card padding="md" className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Where it goes</p>
          <p className="mt-0.5 text-[10px] text-ink-400">
            Spend by category · this month
          </p>
        </div>
        <Link
          to="/employee/analytics"
          aria-label="Open expense analytics"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink-400 transition-colors hover:border-line-strong hover:text-ink"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {data.length ? (
        <>
          <div className="mt-5 flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-line-soft">
            {data.map((item) => (
              <span
                key={item.key}
                title={`${item.name}: ${formatINR(item.value)}`}
                className="h-full rounded-full"
                style={{
                  flexGrow: item.share,
                  flexBasis: 0,
                  minWidth: item.share > 0 ? 6 : 0,
                  backgroundColor: item.fill,
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
            {data.map((item) => (
              <div key={item.key} className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-500">
                  {item.name}
                </p>
                <span className="text-[9px] font-semibold text-ink-300">
                  {item.count}
                </span>
                <p className="w-[84px] text-right text-xs font-semibold tabular-nums text-ink">
                  {formatINR(item.value)}
                </p>
                <p className="w-8 text-right text-[9px] font-medium tabular-nums text-ink-400">
                  {item.share}%
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-[9px] text-ink-400">
            <span>{data.length} categories</span>
            <span className="font-semibold text-ink-500">
              {formatINR(total)} claimed
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-cream/60 py-10">
          <p className="text-xs text-ink-400">No category spend yet.</p>
        </div>
      )}
    </Card>
  );
}

function DesktopExpensesPanel({
  rows,
  statusFilter,
  statusCounts,
  filter,
  query,
  onStatusChange,
  onFilterChange,
  onQueryChange,
  onReset,
}: {
  rows: ExpenseRecord[];
  statusFilter: StatusFilter;
  statusCounts: StatusCounts;
  filter: string;
  query: string;
  onStatusChange: (value: StatusFilter) => void;
  onFilterChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onReset: () => void;
}) {
  const navigate = useNavigate();
  const hasFilters =
    filter !== 'all' || statusFilter !== 'all' || query.trim().length > 0;
  const openExpense = (expense: ExpenseRecord) =>
    navigate(`/employee/expenses/${expense.reference_id}`);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-2.5 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="text-sm font-bold text-ink">Your expenses</p>
          <p className="mt-0.5 text-[10px] text-ink-400">
            Every claim in one place.
          </p>
        </div>
        <Link
          to="/employee/analytics"
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink-500 transition-colors hover:text-ink"
        >
          View analytics
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex gap-5 overflow-x-auto border-b border-line px-4 sm:px-5">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatusChange(tab.value)}
              className={cn(
                'relative flex items-center gap-1.5 whitespace-nowrap pb-3 pt-1 text-xs font-semibold transition-colors',
                active ? 'text-ink' : 'text-ink-400 hover:text-ink'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  active ? 'bg-ink text-cream' : 'bg-cream text-ink-500'
                )}
              >
                {statusCounts[tab.value]}
              </span>
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 border-b border-line-soft px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Search expenses"
            placeholder="Search merchant, reference, or purpose"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            leading={<Search className="h-3.5 w-3.5" />}
            className="h-10"
          />
        </div>
        <Select
          aria-label="Filter by category"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          className="h-10 sm:w-[184px]"
        >
          {CATEGORY_FILTERS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.key === 'all' ? 'All categories' : item.label}
            </option>
          ))}
        </Select>
        <p className="shrink-0 text-[10px] font-medium text-ink-400 sm:ml-auto">
          {rows.length} {rows.length === 1 ? 'claim' : 'claims'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-ink-400">
            <ReceiptText className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink">
            {hasFilters ? 'No claims match these filters' : 'No expenses yet'}
          </p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-ink-400">
            {hasFilters
              ? 'Try a different status, category, or search term.'
              : 'Snap your first bill to start the ledger.'}
          </p>
          {hasFilters ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={onReset}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed">
            <thead>
              <tr className="border-b border-line bg-cream/60">
                <th className="w-[30%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                  Expense
                </th>
                <th className="w-[15%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                  Category
                </th>
                <th className="w-[13%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                  Date
                </th>
                <th className="w-[15%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                  Amount
                </th>
                <th className="w-[21%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                  Status
                </th>
                <th className="w-[6%] px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((expense) => (
                <tr
                  key={expense.id}
                  onClick={() => openExpense(expense)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openExpense(expense);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open claim ${expense.reference_id}`}
                  className="cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-cream/60 focus:bg-cream focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          rowTileTone(expense.review_status)
                        )}
                      >
                        <CategoryIcon category={expense.category} size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {expense.merchant || 'No bill claim'}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-ink-400">
                          {expense.reason || expense.reference_id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block truncate text-xs text-ink-500">
                      {getCategoryOption(expense.category)?.shortLabel ||
                        expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {formatDate(parseExpenseDate(expense.expense_date))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-ink">
                    {formatINR(expense.amount_minor)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={expense.review_status} />
                  </td>
                  <td className="px-2 py-3">
                    <ChevronRight className="h-4 w-4 text-ink-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function EmployeeFeedPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const load = useCallback(async () => {
    try {
      const items = await fetchAllExpenses();
      setExpenses(items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not load expenses.'
      );
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
  const kpis = useMemo(() => employeeKpis(currentMonth), [currentMonth]);
  const monthTotal = kpis.totalClaimed;
  const pendingCount = kpis.pendingCount;
  const rejectedClaims = useMemo(
    () => currentMonth.filter((item) => item.review_status === 'rejected'),
    [currentMonth]
  );
  const currentMonthLabel = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const firstName = EMPLOYEE_NAME.split(' ')[0];

  const activeFilter = CATEGORY_FILTERS.find((item) => item.key === filter);
  const visible = useMemo(() => {
    if (!activeFilter?.categories) return expenses;
    return expenses.filter((item) =>
      activeFilter.categories?.includes(item.category)
    );
  }, [expenses, activeFilter]);

  const desktopRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return expenses
      .filter((item) => {
        if (activeFilter?.categories && !activeFilter.categories.includes(item.category)) {
          return false;
        }
        if (statusFilter !== 'all' && item.review_status !== statusFilter) {
          return false;
        }
        if (!search) return true;
        return [item.merchant, item.reason, item.reference_id]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort(
        (a, b) =>
          parseTimestamp(b.created_at).getTime() -
            parseTimestamp(a.created_at).getTime()
      );
  }, [expenses, activeFilter, statusFilter, query]);

  const statusCounts: StatusCounts = {
    all: expenses.length,
    submitted: expenses.filter((item) => item.review_status === 'submitted').length,
    under_review: expenses.filter((item) => item.review_status === 'under_review')
      .length,
    approved: expenses.filter((item) => item.review_status === 'approved').length,
    rejected: expenses.filter((item) => item.review_status === 'rejected').length,
  };

  const resetDesktopFilters = () => {
    setFilter('all');
    setStatusFilter('all');
    setQuery('');
  };

  if (isDesktop) {
    return (
      <div className="animate-fade-in space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
              Workspace overview
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-[-0.03em] text-ink">
                Hello, {firstName}
              </h1>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-1 text-xs text-ink-400">
              Here’s what’s happening with your expenses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[10px] font-semibold text-ink-500 sm:inline-flex">
              <CalendarDays className="h-3.5 w-3.5 text-ink-400" />
              {currentMonthLabel}
            </span>
            <Link to="/employee/no-bill">
              <Button variant="secondary" size="md">
                <ReceiptText className="h-4 w-4" />
                No bill
              </Button>
            </Link>
            <Link to="/employee/snap">
              <Button size="md">
                <Camera className="h-4 w-4" />
                New expense
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading your workspace…" />
        ) : error ? (
          <ErrorState
            title="Couldn’t load expenses"
            message={error}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <EmployeeKpiCard
                label="Total this month"
                value={formatINR(kpis.totalClaimed)}
                hint={`${kpis.totalClaims} ${
                  kpis.totalClaims === 1 ? 'claim' : 'claims'
                } this month`}
                icon={ReceiptText}
                tone="ink"
              />
              <EmployeeKpiCard
                label="Awaiting review"
                value={formatINR(kpis.pendingSpend)}
                hint={`${kpis.pendingCount} ${
                  kpis.pendingCount === 1 ? 'claim needs' : 'claims need'
                } review`}
                icon={Clock3}
                tone="amber"
              />
              <EmployeeKpiCard
                label="Approved"
                value={formatINR(kpis.approvedSpend)}
                hint={`${kpis.approvedCount} approved ${
                  kpis.approvedCount === 1 ? 'claim' : 'claims'
                }`}
                icon={CheckCircle2}
                tone="success"
              />
              <EmployeeKpiCard
                label="Receipt coverage"
                value={`${kpis.receiptCoverage}%`}
                hint={`${kpis.withReceiptCount} of ${kpis.totalClaims} claims have receipts`}
                icon={Paperclip}
                tone="info"
              />
            </div>

            {rejectedClaims.length > 0 ? (
              <Link
                to={`/employee/expenses/${rejectedClaims[0].reference_id}`}
                className="group flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100/70"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">
                    {rejectedClaims.length}{' '}
                    {rejectedClaims.length === 1 ? 'claim needs' : 'claims need'}{' '}
                    your attention
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-ink-500">
                    Finance left a note on{' '}
                    {rejectedClaims[0].merchant || 'your claim'}. Open it to review
                    the decision.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <SpendingOverviewCard expenses={expenses} />
              <CategoryBreakdownCard expenses={currentMonth} />
            </div>

            <DesktopExpensesPanel
              rows={desktopRows}
              statusFilter={statusFilter}
              statusCounts={statusCounts}
              filter={filter}
              query={query}
              onStatusChange={setStatusFilter}
              onFilterChange={setFilter}
              onQueryChange={setQuery}
              onReset={resetDesktopFilters}
            />
          </>
        )}
      </div>
    );
  }

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
