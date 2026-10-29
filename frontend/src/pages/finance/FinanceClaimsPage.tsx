import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Inbox,
  Search,
} from 'lucide-react';
import {
  CATEGORY_OPTIONS,
  fetchAllExpenses,
  getCategoryLabel,
  getCategoryOption,
  type CategoryKey,
  type ExpenseRecord,
} from '../../lib/api';
import { formatDate, formatINR, parseExpenseDate } from '../../lib/format';
import { isPending, statusMeta } from '../../lib/status';
import { useReloadOnFocus } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Input, Select } from '../../components/ui/Input';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'needs_review' | 'approved' | 'rejected';
type SortKey = 'date' | 'merchant' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors',
        active ? 'text-ink' : 'text-ink-400 hover:text-ink',
        className
      )}
    >
      {label}
      {active ? (
        sort.direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function QueueStat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-cream/40">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-cream">{value}</p>
      </div>
    </div>
  );
}

function claimTileTone(status: string): string {
  if (status === 'approved') return 'bg-success-50 text-success-600';
  if (status === 'rejected') return 'bg-danger-50 text-danger-600';
  if (status === 'under_review') return 'bg-amber-50 text-amber-600';
  return 'bg-cream text-ink-500';
}

export function FinanceClaimsPage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<'all' | CategoryKey>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await fetchAllExpenses();
      setExpenses(items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not load claims.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useReloadOnFocus(load);

  useEffect(() => {
    setPage(1);
    setExpanded(false);
  }, [query, status, category, from, to]);

  const stats = useMemo(
    () =>
      expenses.reduce(
        (totals, item) => {
          if (isPending(item.review_status)) {
            totals.pendingCount += 1;
            totals.pendingAmount += item.amount_minor;
          } else if (item.review_status === 'approved') {
            totals.approvedCount += 1;
            totals.approvedAmount += item.amount_minor;
          } else if (item.review_status === 'rejected') {
            totals.rejectedCount += 1;
          }
          totals.totalAmount += item.amount_minor;
          return totals;
        },
        {
          pendingCount: 0,
          pendingAmount: 0,
          approvedCount: 0,
          approvedAmount: 0,
          rejectedCount: 0,
          totalAmount: 0,
        }
      ),
    [expenses]
  );

  const statusCounts = useMemo<Record<StatusFilter, number>>(
    () => ({
      all: expenses.length,
      needs_review: stats.pendingCount,
      approved: stats.approvedCount,
      rejected: stats.rejectedCount,
    }),
    [expenses.length, stats]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return expenses.filter((item) => {
      if (status === 'needs_review' && !isPending(item.review_status)) return false;
      if (status !== 'all' && status !== 'needs_review' && item.review_status !== status) {
        return false;
      }
      if (category !== 'all' && item.category !== category) return false;
      if (from && item.expense_date < from) return false;
      if (to && item.expense_date > to) return false;
      if (term) {
        const haystack = `${item.merchant || ''} ${item.reference_id} ${item.reason}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [expenses, query, status, category, from, to]);

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'amount') return (a.amount_minor - b.amount_minor) * factor;
      if (sort.key === 'merchant') {
        return (a.merchant || '').localeCompare(b.merchant || '') * factor;
      }
      if (sort.key === 'status') {
        return (
          statusMeta(a.review_status).label.localeCompare(
            statusMeta(b.review_status).label
          ) * factor
        );
      }
      return (
        (a.expense_date.localeCompare(b.expense_date) ||
          a.created_at.localeCompare(b.created_at)) * factor
      );
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = expanded ? (safePage - 1) * PAGE_SIZE : 0;
  const visible = expanded ? sorted.slice(start, start + PAGE_SIZE) : sorted.slice(0, 3);
  const hiddenCount = Math.max(0, sorted.length - visible.length);

  const hasFilters =
    query !== '' || status !== 'all' || category !== 'all' || from !== '' || to !== '';

  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setCategory('all');
    setFrom('');
    setTo('');
  };

  const changeSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'date' ? 'desc' : 'asc' }
    );
  };

  const openClaim = (expense: ExpenseRecord) => {
    navigate(`/finance/claims/${expense.reference_id}`);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Claims</h1>
        <p className="mt-1 text-xs text-ink-400">
          {expenses.length} {expenses.length === 1 ? 'claim' : 'claims'} ·{' '}
          {formatINR(stats.totalAmount)} claimed
        </p>
      </div>

      <Card tone="dark" padding="md" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-amber-400/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cream/50">
              Review queue
            </p>
            <p className="mt-1.5 text-3xl font-bold tracking-[-0.03em] text-cream">
              {formatINR(stats.pendingAmount)}
            </p>
            <p className="mt-1 text-xs text-cream/60">
              {stats.pendingCount === 0
                ? 'Queue is clear — no claims waiting.'
                : `${stats.pendingCount} ${
                    stats.pendingCount === 1 ? 'claim' : 'claims'
                  } awaiting a decision`}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300">
            <Inbox className="h-5 w-5" />
          </span>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <QueueStat label="In queue" value={stats.pendingCount} dot="bg-amber-400" />
          <QueueStat label="Approved" value={stats.approvedCount} dot="bg-success-500" />
          <QueueStat label="Rejected" value={stats.rejectedCount} dot="bg-danger-500" />
        </div>
      </Card>

      <Card padding="sm" className="space-y-3">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
              Status
            </p>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="text-[10px] font-semibold text-ink-500 transition-colors hover:text-ink disabled:cursor-default disabled:text-ink-400/50"
            >
              Reset filters
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => (
              <Chip
                key={option.value}
                selected={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                    status === option.value
                      ? 'bg-white/15 text-cream'
                      : 'bg-cream text-ink-500'
                  )}
                >
                  {statusCounts[option.value]}
                </span>
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-2 border-t border-line-soft pt-3 xl:grid-cols-[minmax(0,1fr)_180px_150px_150px] xl:items-end">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] xl:contents">
            <Input
              label="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Merchant, reference, purpose"
              leading={<Search className="h-3.5 w-3.5" />}
              aria-label="Search claims"
              className="h-10"
            />
            <Select
              label="Category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as 'all' | CategoryKey)
              }
              aria-label="Filter by category"
              className="h-10"
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(2,160px)] xl:contents">
            <Input
              label="From"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10"
            />
            <Input
              label="To"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <p className="border-t border-line-soft pt-2.5 text-[10px] text-ink-400">
          {sorted.length} {sorted.length === 1 ? 'result' : 'results'}
          {hasFilters ? ' with filters applied' : ' in the ledger'}
        </p>
      </Card>

      {loading ? (
        <LoadingState label="Loading claims…" />
      ) : error ? (
        <ErrorState
          title="Couldn’t load claims"
          message={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No claims found"
          description={
            hasFilters ? 'Clear the filters to see all claims.' : 'Claims will appear here.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">
                Claim list
              </p>
              <p className="mt-0.5 text-[10px] text-ink-400">
                Newest expense first unless sorted
              </p>
            </div>
            <span className="text-[10px] font-medium text-ink-400">
              {sorted.length} {sorted.length === 1 ? 'claim' : 'claims'}
            </span>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-line bg-white shadow-card md:block">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  <th className="w-[29%] px-4 py-3 text-left">
                    <SortHeader
                      label="Claim"
                      sortKey="merchant"
                      sort={sort}
                      onSort={changeSort}
                    />
                  </th>
                  <th className="w-[16%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                    Category
                  </th>
                  <th className="w-[14%] px-4 py-3 text-left">
                    <SortHeader
                      label="Date"
                      sortKey="date"
                      sort={sort}
                      onSort={changeSort}
                    />
                  </th>
                  <th className="w-[16%] px-4 py-3 text-right">
                    <SortHeader
                      label="Amount"
                      sortKey="amount"
                      sort={sort}
                      onSort={changeSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="w-[25%] px-4 py-3 text-right">
                    <SortHeader
                      label="Status"
                      sortKey="status"
                      sort={sort}
                      onSort={changeSort}
                      className="justify-end"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((expense) => (
                  <tr
                    key={expense.id}
                    onClick={() => openClaim(expense)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openClaim(expense);
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
                            claimTileTone(expense.review_status)
                          )}
                        >
                          <CategoryIcon category={expense.category} size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {expense.merchant || 'No bill claim'}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-ink-400">
                            {expense.reference_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block truncate text-xs text-ink-500">
                        {getCategoryOption(expense.category)?.shortLabel ||
                          getCategoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {formatDate(parseExpenseDate(expense.expense_date))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-ink">
                      {formatINR(expense.amount_minor)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <StatusBadge status={expense.review_status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {visible.map((expense) => (
              <Link
                key={expense.id}
                to={`/finance/claims/${expense.reference_id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-card transition-colors active:bg-cream"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    claimTileTone(expense.review_status)
                  )}
                >
                  <CategoryIcon category={expense.category} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {expense.merchant || 'No bill claim'}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-ink-400">
                    {getCategoryOption(expense.category)?.shortLabel ||
                      getCategoryLabel(expense.category)}{' '}
                    · {formatDate(parseExpenseDate(expense.expense_date))}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-ink-400">
                    {expense.reference_id}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-bold tabular-nums text-ink">
                    {formatINR(expense.amount_minor)}
                  </p>
                  <StatusBadge status={expense.review_status} />
                </div>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-300 sm:block" />
              </Link>
            ))}
          </div>

          {!expanded && hiddenCount > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-ink-400">
                Showing {visible.length} of {sorted.length}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setExpanded(true);
                  setPage(1);
                }}
              >
                More transactions
                <span className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-bold text-ink-500">
                  {hiddenCount}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : totalPages > 1 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-ink-400">
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of{' '}
                {sorted.length}
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <span className="px-1 text-[11px] font-semibold text-ink-500">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : expanded ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-3">
              <p className="text-[11px] text-ink-400">Showing all {sorted.length}</p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-cream hover:text-ink"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
