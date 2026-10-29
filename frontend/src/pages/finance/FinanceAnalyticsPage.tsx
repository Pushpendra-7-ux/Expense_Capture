import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  PieChart,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react';
import { fetchAllExpenses, type ExpenseRecord } from '../../lib/api';
import {
  financeKpis,
  spendByCategory,
  spendOverTime,
} from '../../lib/analytics';
import { formatINR } from '../../lib/format';
import { useReloadOnFocus } from '../../lib/hooks';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { cn } from '../../lib/cn';

type KpiTone = 'success' | 'amber' | 'ink' | 'info';

const kpiTones: Record<KpiTone, string> = {
  success: 'bg-success-50 text-success-600',
  amber: 'bg-amber-50 text-amber-600',
  ink: 'bg-cream text-ink',
  info: 'bg-info-50 text-info-500',
};

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: KpiTone;
}) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
          {label}
        </p>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            kpiTones[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] text-ink-400">{hint}</p>
    </Card>
  );
}

const axisTick = { fontSize: 10, fill: '#6D6D78' };
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E5DFD3',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(11, 11, 15, 0.08)',
};

export function FinanceAnalyticsPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const kpis = useMemo(() => financeKpis(expenses), [expenses]);
  const categoryData = useMemo(() => spendByCategory(expenses), [expenses]);
  const monthlyData = useMemo(() => spendOverTime(expenses), [expenses]);
  const approvedTotal = kpis.approvedSpend;
  const monthlyTotal = monthlyData.reduce((sum, item) => sum + item.spend, 0) * 100;

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Analytics</h1>
        <p className="mt-1 text-xs text-ink-400">
          {kpis.totalClaims} {kpis.totalClaims === 1 ? 'claim' : 'claims'} · all time
        </p>
      </div>

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
          description="Analytics appear once claims are submitted."
          icon={<BarChart3 className="h-5 w-5" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              label="Approved spend"
              value={formatINR(kpis.approvedSpend)}
              hint="Reimbursable"
              icon={CheckCircle2}
              tone="success"
            />
            <KpiCard
              label="Pending spend"
              value={formatINR(kpis.pendingSpend)}
              hint="Awaiting review"
              icon={Clock3}
              tone="amber"
            />
            <KpiCard
              label="Total claims"
              value={String(kpis.totalClaims)}
              hint="All statuses"
              icon={ReceiptText}
              tone="ink"
            />
            <KpiCard
              label="Approval rate"
              value={`${kpis.approvalRate}%`}
              hint="Of decided claims"
              icon={PieChart}
              tone="info"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="md">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">Spend by category</p>
                  <p className="mt-0.5 text-[10px] text-ink-400">
                    {categoryData.length}{' '}
                    {categoryData.length === 1 ? 'category' : 'categories'} · approved
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-ink">
                    {formatINR(approvedTotal)}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    total
                  </p>
                </div>
              </div>
              {categoryData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-line bg-cream/60">
                  <p className="text-xs text-ink-400">No approved spend yet.</p>
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#EFEBE2" />
                      <XAxis
                        type="number"
                        tick={axisTick}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `₹${Number(value).toLocaleString('en-IN')}`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={axisTick}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value) => formatINR(Number(value) * 100)}
                        contentStyle={tooltipStyle}
                        cursor={{ fill: '#FBF9F4' }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                        {categoryData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card padding="md">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">Spend over time</p>
                  <p className="mt-0.5 text-[10px] text-ink-400">
                    Last 6 months · approved
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-ink">
                    {formatINR(monthlyTotal)}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                    6-month total
                  </p>
                </div>
              </div>
              {approvedTotal === 0 ? (
                <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-line bg-cream/60">
                  <p className="text-xs text-ink-400">No approved spend yet.</p>
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyData}
                      margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C58A2A" stopOpacity={0.24} />
                          <stop offset="100%" stopColor="#C58A2A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#EFEBE2" />
                      <XAxis
                        dataKey="month"
                        tick={axisTick}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        width={56}
                        tick={axisTick}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `₹${Number(value).toLocaleString('en-IN')}`
                        }
                      />
                      <Tooltip
                        formatter={(value) => formatINR(Number(value) * 100)}
                        contentStyle={tooltipStyle}
                      />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        stroke="#C58A2A"
                        strokeWidth={2}
                        fill="url(#spendFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
