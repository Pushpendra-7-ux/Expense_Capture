import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import {
  attachmentUrl,
  fetchExpenseById,
  getCategoryLabel,
  type ExpenseRecord,
} from '../../lib/api';
import { summarizeExtraction } from '../../lib/extraction';
import {
  formatDateFull,
  formatINR,
  formatTime,
  parseExpenseDate,
  parseTimestamp,
} from '../../lib/format';
import { useReloadOnFocus } from '../../lib/hooks';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { AttachmentGrid, type AttachmentTile } from '../../components/ui/AttachmentGrid';
import { Detail, DetailGrid } from '../../components/ui/Detail';
import { ExtractionFlags } from '../../components/ui/ExtractionFlags';
import { LineItemsCard } from '../../components/ui/LineItemsCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

const RECEIPT_LABELS = {
  bill_photo: 'Bill photo',
  payment_screenshot: 'Payment screenshot',
  none: 'No receipt',
} as const;

export function EmployeeExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const record = await fetchExpenseById(id);
      setExpense(record);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not load this claim.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useReloadOnFocus(load);

  const summary = useMemo(
    () => (expense ? summarizeExtraction(expense.extraction_json) : null),
    [expense]
  );

  const attachments: AttachmentTile[] = useMemo(() => {
    if (!expense) return [];
    return (expense.attachments || []).map((item) => ({
      id: item.id,
      url: attachmentUrl(expense.reference_id, item.id),
      name: item.filename || 'Attachment',
      mime: item.mime,
    }));
  }, [expense]);

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/employee"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong"
          aria-label="Back to expenses"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-ink">
            Claim detail
          </h1>
          <p className="font-mono text-[10px] text-ink-400">{id}</p>
        </div>
        {expense ? <StatusBadge status={expense.review_status} /> : null}
      </div>

      {loading ? (
        <LoadingState label="Loading claim…" />
      ) : error || !expense ? (
        <ErrorState
          title="Couldn’t load this claim"
          message={error || undefined}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : (
        <>
          <Card padding="md">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
                  {getCategoryLabel(expense.category)}
                </p>
                <p className="mt-1 truncate text-lg font-bold text-ink">
                  {expense.merchant || 'No bill claim'}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">
                  {formatINR(expense.amount_minor)}
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream text-ink-500">
                <CategoryIcon category={expense.category} size={20} />
              </span>
            </div>
          </Card>

          {expense.review_note ? (
            <Card tone="amber" padding="sm" className="flex items-start gap-2.5">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600">
                  Finance note
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-500">
                  {expense.review_note}
                </p>
              </div>
            </Card>
          ) : null}

          <Card padding="md">
            <DetailGrid>
              <Detail label="Expense date" value={formatDateFull(parseExpenseDate(expense.expense_date))} />
              <Detail label="Receipt" value={RECEIPT_LABELS[expense.receipt_type]} />
              <Detail label="Reference" value={expense.reference_id} mono />
              <Detail
                label="Submitted"
                value={`${formatDateFull(parseTimestamp(expense.created_at))} · ${formatTime(
                  parseTimestamp(expense.created_at)
                )}`}
              />
              {expense.reviewed_by ? (
                <Detail label="Reviewed by" value={expense.reviewed_by} />
              ) : null}
              {expense.reviewed_at ? (
                <Detail
                  label="Reviewed"
                  value={`${formatDateFull(parseTimestamp(expense.reviewed_at))} · ${formatTime(
                    parseTimestamp(expense.reviewed_at)
                  )}`}
                />
              ) : null}
            </DetailGrid>
          </Card>

          <Card padding="md">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Business purpose
            </p>
            <p className="mt-1.5 text-sm leading-6 text-ink">{expense.reason}</p>
          </Card>

          {summary ? <LineItemsCard items={summary.lineItems} claimedAmountMinor={expense.amount_minor} /> : null}

          {summary ? <ExtractionFlags summary={summary} /> : null}

          {attachments.length > 0 ? (
            <Card padding="md">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500">
                  Attachments
                </p>
                <span className="text-[10px] text-ink-400">{attachments.length}</span>
              </div>
              <AttachmentGrid items={attachments} />
            </Card>
          ) : (
            <EmptyState
              title="No receipt attached"
              description="This claim was submitted without a bill."
            />
          )}

          <div className="pt-1">
            <Link to="/employee">
              <Button variant="secondary" fullWidth>
                <ArrowLeft className="h-4 w-4" />
                Back to expenses
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
