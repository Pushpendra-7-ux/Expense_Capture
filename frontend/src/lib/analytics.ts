import {
  CATEGORY_OPTIONS,
  getCategoryOption,
  type ExpenseRecord,
  type ReviewStatus,
} from './api';
import { parseExpenseDate, todayISO, toISODate } from './format';
import { statusMeta } from './status';

export const CHART_COLORS = [
  '#0B0B0F',
  '#C58A2A',
  '#4B657F',
  '#2F7D54',
  '#B4453F',
  '#8C7A5B',
  '#6D6D78',
];

export interface CategorySpend {
  name: string;
  value: number;
  fill: string;
}

export interface MonthSpend {
  month: string;
  spend: number;
}

export interface FinanceKpis {
  approvedSpend: number;
  pendingSpend: number;
  totalClaims: number;
  approvalRate: number;
}

export function financeKpis(expenses: ExpenseRecord[]): FinanceKpis {
  const approved = expenses.filter((item) => item.review_status === 'approved');
  const pending = expenses.filter(
    (item) => item.review_status === 'submitted' || item.review_status === 'under_review'
  );
  const rejected = expenses.filter((item) => item.review_status === 'rejected');
  const decided = approved.length + rejected.length;

  return {
    approvedSpend: approved.reduce((sum, item) => sum + item.amount_minor, 0),
    pendingSpend: pending.reduce((sum, item) => sum + item.amount_minor, 0),
    totalClaims: expenses.length,
    approvalRate: decided ? Math.round((approved.length / decided) * 100) : 0,
  };
}

export function spendByCategory(expenses: ExpenseRecord[]): CategorySpend[] {
  const totals = new Map<string, number>();
  expenses
    .filter((item) => item.review_status === 'approved')
    .forEach((item) => {
      totals.set(item.category, (totals.get(item.category) || 0) + item.amount_minor);
    });

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, value], index) => ({
      name: getCategoryOption(category)?.shortLabel || category,
      value: value / 100,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
}

export function spendOverTime(expenses: ExpenseRecord[], count = 6): MonthSpend[] {
  const now = new Date();
  const buckets: { key: string; month: string; spend: number }[] = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    buckets.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      month: date.toLocaleDateString('en-IN', { month: 'short' }),
      spend: 0,
    });
  }

  expenses
    .filter((item) => item.review_status === 'approved')
    .forEach((item) => {
      const date = parseExpenseDate(item.expense_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.find((entry) => entry.key === key);
      if (bucket) bucket.spend += item.amount_minor / 100;
    });

  return buckets.map(({ month, spend }) => ({ month, spend }));
}

/* ------------------------------------------------------------------ */
/* Employee insights                                                   */
/* ------------------------------------------------------------------ */

export type EmployeePeriod = 'month' | 'quarter' | 'all';

export interface EmployeeKpis {
  totalClaimed: number;
  averageClaim: number;
  approvedSpend: number;
  pendingSpend: number;
  approvalRate: number;
  receiptCoverage: number;
  totalClaims: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  withReceiptCount: number;
}

export interface EmployeeCategorySpend {
  key: string;
  name: string;
  value: number;
  count: number;
  share: number;
  fill: string;
}

export interface EmployeeStatusSpend {
  status: ReviewStatus;
  label: string;
  count: number;
  value: number;
  fill: string;
}

export interface EmployeeTrendPoint {
  key: string;
  label: string;
  fullLabel: string;
  spend: number;
  count: number;
}

export interface CumulativeSpendPoint {
  day: number;
  label: string;
  fullLabel: string;
  daily: number;
  cumulative: number;
}

const EMPLOYEE_STATUS_ORDER: ReviewStatus[] = [
  'approved',
  'under_review',
  'submitted',
  'rejected',
];

const EMPLOYEE_STATUS_FILLS: Record<ReviewStatus, string> = {
  approved: '#2F7D54',
  under_review: '#C58A2A',
  submitted: '#4B657F',
  rejected: '#B4453F',
};

function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

function monthKeyOffset(offset: number): string {
  const [year, month] = todayISO().split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeysFrom(startKey: string, endKey: string): string[] {
  let [year, month] = startKey.split('-').map(Number);
  const [endYear, endMonth] = endKey.split('-').map(Number);
  const keys: string[] = [];

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return keys;
}

function monthLabel(key: string): { label: string; fullLabel: string } {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return {
    label: date.toLocaleDateString('en-IN', { month: 'short' }),
    fullLabel: date.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
  };
}

export function filterEmployeeExpenses(
  expenses: ExpenseRecord[],
  period: EmployeePeriod
): ExpenseRecord[] {
  const current = currentMonthKey();

  if (period === 'month') {
    return expenses.filter((item) => item.expense_date.slice(0, 7) === current);
  }

  if (period === 'quarter') {
    const start = monthKeyOffset(-2);
    return expenses.filter((item) => {
      const key = item.expense_date.slice(0, 7);
      return key >= start && key <= current;
    });
  }

  return expenses;
}

export function employeeKpis(expenses: ExpenseRecord[]): EmployeeKpis {
  const approved = expenses.filter((item) => item.review_status === 'approved');
  const pending = expenses.filter(
    (item) => item.review_status === 'submitted' || item.review_status === 'under_review'
  );
  const rejected = expenses.filter((item) => item.review_status === 'rejected');
  const decided = approved.length + rejected.length;
  const totalClaimed = expenses.reduce((sum, item) => sum + item.amount_minor, 0);
  const withReceiptCount = expenses.filter((item) => item.attachment_count > 0).length;

  return {
    totalClaimed,
    averageClaim: expenses.length
      ? Math.round(totalClaimed / expenses.length)
      : 0,
    approvedSpend: approved.reduce((sum, item) => sum + item.amount_minor, 0),
    pendingSpend: pending.reduce((sum, item) => sum + item.amount_minor, 0),
    approvalRate: decided ? Math.round((approved.length / decided) * 100) : 0,
    receiptCoverage: expenses.length
      ? Math.round((withReceiptCount / expenses.length) * 100)
      : 0,
    totalClaims: expenses.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    rejectedCount: rejected.length,
    withReceiptCount,
  };
}

export function employeeCategorySpend(
  expenses: ExpenseRecord[]
): EmployeeCategorySpend[] {
  const totals = new Map<string, { value: number; count: number }>();
  const total = expenses.reduce((sum, item) => sum + item.amount_minor, 0);

  expenses.forEach((item) => {
    const entry = totals.get(item.category) || { value: 0, count: 0 };
    entry.value += item.amount_minor;
    entry.count += 1;
    totals.set(item.category, entry);
  });

  return Array.from(totals.entries())
    .filter(([, entry]) => entry.value > 0)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, entry]) => {
      const option = getCategoryOption(key);
      const optionIndex = CATEGORY_OPTIONS.findIndex((item) => item.key === key);
      return {
        key,
        name: option?.shortLabel || key,
        value: entry.value,
        count: entry.count,
        share: total ? Math.round((entry.value / total) * 100) : 0,
        fill: CHART_COLORS[Math.max(0, optionIndex) % CHART_COLORS.length],
      };
    });
}

export function employeeStatusSpend(
  expenses: ExpenseRecord[]
): EmployeeStatusSpend[] {
  return EMPLOYEE_STATUS_ORDER.map((status) => {
    const rows = expenses.filter((item) => item.review_status === status);
    return {
      status,
      label: statusMeta(status).label,
      count: rows.length,
      value: rows.reduce((sum, item) => sum + item.amount_minor, 0),
      fill: EMPLOYEE_STATUS_FILLS[status],
    };
  });
}

export function employeeTrend(
  expenses: ExpenseRecord[],
  period: EmployeePeriod
): EmployeeTrendPoint[] {
  const current = currentMonthKey();

  if (period === 'month') {
    const [year, month] = current.split('-').map(Number);
    const dayCount = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
    });
    const buckets = new Map<number, { spend: number; count: number }>();

    expenses.forEach((item) => {
      if (item.expense_date.slice(0, 7) !== current) return;
      const day = Number(item.expense_date.slice(8, 10));
      const entry = buckets.get(day) || { spend: 0, count: 0 };
      entry.spend += item.amount_minor / 100;
      entry.count += 1;
      buckets.set(day, entry);
    });

    return Array.from({ length: dayCount }, (_, index) => {
      const day = index + 1;
      const entry = buckets.get(day);
      const label = String(day).padStart(2, '0');
      return {
        key: `${current}-${label}`,
        label,
        fullLabel: `${label} ${monthName}`,
        spend: entry?.spend || 0,
        count: entry?.count || 0,
      };
    });
  }

  let startKey =
    period === 'quarter' ? monthKeyOffset(-2) : current;

  if (period === 'all') {
    const earliest = expenses.reduce((minimum, item) => {
      const key = item.expense_date.slice(0, 7);
      return key < minimum ? key : minimum;
    }, current);
    startKey = earliest < current ? earliest : current;
  }

  const keys = monthKeysFrom(startKey, current).slice(-12);
  const buckets = new Map<string, { spend: number; count: number }>();

  expenses.forEach((item) => {
    const key = item.expense_date.slice(0, 7);
    const entry = buckets.get(key) || { spend: 0, count: 0 };
    entry.spend += item.amount_minor / 100;
    entry.count += 1;
    buckets.set(key, entry);
  });

  return keys.map((key) => {
    const entry = buckets.get(key);
    const { label, fullLabel } = monthLabel(key);
    return {
      key,
      label,
      fullLabel,
      spend: entry?.spend || 0,
      count: entry?.count || 0,
    };
  });
}

export function cumulativeMonthSpend(
  expenses: ExpenseRecord[],
  reference: Date = new Date()
): CumulativeSpendPoint[] {
  const key = toISODate(reference).slice(0, 7);
  const [year, month] = key.split('-').map(Number);
  const dayCount = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
  });
  const daily = new Map<number, number>();

  expenses.forEach((item) => {
    if (item.expense_date.slice(0, 7) !== key) return;
    const day = Number(item.expense_date.slice(8, 10));
    daily.set(day, (daily.get(day) || 0) + item.amount_minor / 100);
  });

  let running = 0;

  return Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const daySpend = daily.get(day) || 0;
    running += daySpend;
    const label = String(day).padStart(2, '0');
    return {
      day,
      label,
      fullLabel: `${label} ${monthName}`,
      daily: daySpend,
      cumulative: running,
    };
  });
}
