import { getCategoryOption, type ExpenseRecord } from './api';
import { parseExpenseDate } from './format';

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
