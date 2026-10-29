import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarRange,
  Download,
  Paperclip,
  PieChart,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import {
  fetchAllExpenses,
  getCategoryLabel,
  type ExpenseRecord,
} from '../../lib/api';
import {
  employeeCategorySpend,
  employeeKpis,
  employeeStatusSpend,
  employeeTrend,
  filterEmployeeExpenses,
  type EmployeePeriod,
} from '../../lib/analytics';
import { formatINR } from '../../lib/format';
import { statusMeta } from '../../lib/status';
import { useReloadOnFocus } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Input';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui/States';
import { EmployeeKpiCard } from '../../components/employee/EmployeeKpiCard';
import { EmployeeChartTooltip } from '../../components/employee/EmployeeChartTooltip';

const PERIOD_OPTIONS: Array<{ value: EmployeePeriod; label: string }> = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'all', label: 'All time' },
];

const PERIOD_LABELS: Record<EmployeePeriod, string> = {
  month: 'this month',
  quarter: 'the last 3 months',
  all: 'all time',
};

const axisTick = { fontSize: 10, fill: '#6D6D78' };

function axisCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

function TrendCard({
  data,
  period,
  total,
}: {
  data: ReturnType<typeof employeeTrend>;
  period: EmployeePeriod;
  total: number;
}) {
  const hasSpend = data.some((item) => item.spend > 0);
  const subtitle =
    period === 'month'
      ? 'Daily claimed spend · this month'
      : period === 'quarter'
        ? 'Monthly claimed spend · last 3 months'
        : 'Monthly claimed spend · all time';

  return (
    <Card padding="md" className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Spending over time</p>
          <p className="mt-0.5 text-[10px] text-ink-400">{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tracking-[-0.02em] text-ink">
            {formatINR(total)}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            claimed
          </p>
        </div>
      </div>

      {hasSpend ? (
        <div className="mt-5 h-[272px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="24%"
            >
              <defs>
                <linearGradient
                  id="employeeTrendFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#C58A2A" stopOpacity={0.96} />
                  <stop offset="100%" stopColor="#EED6A3" stopOpacity={0.55} />
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
                interval={period === 'month' ? 3 : 0}
              />
              <YAxis
                width={52}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={axisCurrency}
              />
              <Tooltip
                content={<EmployeeChartTooltip valueLabel="Claimed" />}
                cursor={{ fill: 'rgba(197, 138, 42, 0.06)' }}
              />
              <Bar
                dataKey="spend"
                fill="url(#employeeTrendFill)"
                radius={[7, 7, 2, 2]}
                maxBarSize={period === 'month' ? 18 : 48}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-5 flex h-[272px] items-center justify-center rounded-xl border border-dashed border-line bg-cream/60">
          <div className="text-center">
            <BarChart3 className="mx-auto h-5 w-5 text-ink-300" />
            <p className="mt-2 text-xs text-ink-400">
              No claimed spend in this period.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatusCard({
  data,
  totalClaims,
}: {
  data: ReturnType<typeof employeeStatusSpend>;
  totalClaims: number;
}) {
  return (
    <Card padding="md" className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Claims by status</p>
          <p className="mt-0.5 text-[10px] text-ink-400">
            How your claims are moving
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tracking-[-0.02em] text-ink">
            {totalClaims}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            claims
          </p>
        </div>
      </div>

      <div className="mt-5 flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-line-soft">
        {data.map((row) => (
          <span
            key={row.status}
            title={`${row.label}: ${row.count}`}
            className="h-full rounded-full"
            style={{
              flexGrow: row.count,
              flexBasis: 0,
              minWidth: row.count > 0 ? 8 : 0,
              backgroundColor: row.fill,
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-center">
        {data.map((row) => (
          <div
            key={row.status}
            className="flex items-center gap-2.5 border-b border-line-soft py-2.5 last:border-0"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.fill }}
            />
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-500">
              {row.label}
            </p>
            <span className="text-[10px] font-semibold text-ink-300">
              {row.count}
            </span>
            <p className="w-[78px] text-right text-xs font-semibold tabular-nums text-ink">
              {formatINR(row.value)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CategoryCard({
  data,
  total,
}: {
  data: ReturnType<typeof employeeCategorySpend>;
  total: number;
}) {
  return (
    <Card padding="md" className="flex h-full min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">Spend by category</p>
          <p className="mt-0.5 text-[10px] text-ink-400">
            The distribution behind the total
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tracking-[-0.02em] text-ink">
            {formatINR(total)}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-400">
            claimed
          </p>
        </div>
      </div>

      {data.length ? (
        <>
          <div className="mt-5 flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-line-soft">
            {data.map((row) => (
              <span
                key={row.key}
                title={`${row.name}: ${formatINR(row.value)}`}
                className="h-full rounded-full"
                style={{
                  flexGrow: row.share,
                  flexBasis: 0,
                  minWidth: row.share > 0 ? 6 : 0,
                  backgroundColor: row.fill,
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-1 flex-col justify-center">
            {data.map((row) => (
              <div key={row.key} className="flex items-center gap-2.5 py-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.fill }}
                />
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-500">
                  {row.name}
                </p>
                <span className="text-[9px] font-semibold text-ink-300">
                  {row.count}
                </span>
                <p className="w-[82px] text-right text-xs font-semibold tabular-nums text-ink">
                  {formatINR(row.value)}
                </p>
                <p className="w-8 text-right text-[9px] font-medium tabular-nums text-ink-400">
                  {row.share}%
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-cream/60 py-10">
          <p className="text-xs text-ink-400">No category spend in this period.</p>
        </div>
      )}
    </Card>
  );
}

function CategoryDetailCard({
  data,
}: {
  data: ReturnType<typeof employeeCategorySpend>;
}) {
  return (
    <Card padding="md" className="flex h-full min-w-0 flex-col">
      <div>
        <p className="text-sm font-bold text-ink">Category detail</p>
        <p className="mt-0.5 text-[10px] text-ink-400">
          Claims and average value by category
        </p>
      </div>

      {data.length ? (
        <div className="mt-2 flex-1">
          {data.map((row) => {
            const average = row.count ? Math.round(row.value / row.count) : 0;
            return (
              <div key={row.key} className="border-b border-line-soft py-3 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                  />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                    {row.name}
                  </p>
                  <span className="text-[9px] font-semibold text-ink-300">
                    {row.count} {row.count === 1 ? 'claim' : 'claims'}
                  </span>
                  <p className="w-[82px] text-right text-xs font-semibold tabular-nums text-ink">
                    {formatINR(row.value)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-soft">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${row.share}%`,
                        backgroundColor: row.fill,
                      }}
                    />
                  </div>
                  <span className="w-28 text-right text-[9px] text-ink-400">
                    avg {formatINR(average)} · {row.share}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line bg-cream/60 py-10">
          <p className="text-xs text-ink-400">No category detail to show.</p>
        </div>
      )}
    </Card>
  );
}

export function EmployeeAnalyticsPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<EmployeePeriod>('month');

  const load = useCallback(async () => {
    try {
      const items = await fetchAllExpenses();
      setExpenses(items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not load analytics.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useReloadOnFocus(load);

  const filtered = useMemo(
    () => filterEmployeeExpenses(expenses, period),
    [expenses, period]
  );
  const kpis = useMemo(() => employeeKpis(filtered), [filtered]);
  const categoryData = useMemo(() => employeeCategorySpend(filtered), [filtered]);
  const statusData = useMemo(
    () => employeeStatusSpend(filtered).filter((row) => row.count > 0),
    [filtered]
  );
  const trendData = useMemo(
    () => employeeTrend(filtered, period),
    [filtered, period]
  );

  const exportCsv = () => {
    const header = [
      'Reference',
      'Date',
      'Merchant',
      'Category',
      'Purpose',
      'Status',
      'Amount (INR)',
      'Receipts',
    ];
    const rows = [...filtered]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((expense) => [
        expense.reference_id,
        expense.expense_date,
        expense.merchant || 'No bill claim',
        getCategoryLabel(expense.category),
        expense.reason,
        statusMeta(expense.review_status).label,
        (expense.amount_minor / 100).toFixed(2),
        String(expense.attachment_count),
      ]);

    const sanitize = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return /^[=+\-@]/.test(value) ? `'${escaped}` : escaped;
    };
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${sanitize(cell)}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff', csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employee-expenses-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">
            Turn expenses into insight
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">
            Know where every rupee goes.
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-5 text-ink-400">
            See what you’ve claimed, what’s approved, and where your spend is
            heading.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card
        padding="sm"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-ink-500">
            <CalendarRange className="h-4 w-4" />
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Period
            </span>
            <Select
              aria-label="Analytics period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as EmployeePeriod)}
              className="h-9 w-[168px] text-xs"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-[10px] font-medium text-ink-400">
          {kpis.totalClaims} {kpis.totalClaims === 1 ? 'claim' : 'claims'} ·{' '}
          {PERIOD_LABELS[period]}
        </p>
      </Card>

      {loading ? (
        <LoadingState label="Loading analytics…" />
      ) : error ? (
        <ErrorState
          title="Couldn’t load analytics"
          message={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No claims yet"
          description="Snap your first bill to start building your expense story."
          icon={<BarChart3 className="h-5 w-5" />}
          action={
            <Link to="/employee/snap">
              <Button size="sm">Snap a bill</Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No claims in this period"
          description="Try another period to see earlier expenses."
          icon={<BarChart3 className="h-5 w-5" />}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPeriod('all')}
            >
              View all time
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <EmployeeKpiCard
              label="Total claimed"
              value={formatINR(kpis.totalClaimed)}
              hint={`${kpis.totalClaims} ${
                kpis.totalClaims === 1 ? 'claim' : 'claims'
              } in this period`}
              icon={ReceiptText}
              tone="ink"
            />
            <EmployeeKpiCard
              label="Average claim"
              value={formatINR(kpis.averageClaim)}
              hint="Across every submitted claim"
              icon={Wallet}
              tone="info"
            />
            <EmployeeKpiCard
              label="Approval rate"
              value={`${kpis.approvalRate}%`}
              hint={`${kpis.approvedCount} of ${
                kpis.approvedCount + kpis.rejectedCount
              } decided claims`}
              icon={PieChart}
              tone="success"
            />
            <EmployeeKpiCard
              label="Receipt coverage"
              value={`${kpis.receiptCoverage}%`}
              hint={`${kpis.withReceiptCount} of ${kpis.totalClaims} claims have receipts`}
              icon={Paperclip}
              tone="amber"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <TrendCard
              data={trendData}
              period={period}
              total={kpis.totalClaimed}
            />
            <StatusCard data={statusData} totalClaims={kpis.totalClaims} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <CategoryCard data={categoryData} total={kpis.totalClaimed} />
            <CategoryDetailCard data={categoryData} />
          </div>
        </>
      )}
    </div>
  );
}