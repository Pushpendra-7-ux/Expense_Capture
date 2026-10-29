import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  MessageSquare,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  attachmentUrl,
  EMPLOYEE_NAME,
  EMPLOYEE_ROLE,
  fetchExpenseById,
  getCategoryLabel,
  reviewExpense,
  type ExpenseRecord,
  type ReviewDecisionAction,
} from '../../lib/api';
import { extractionFlags, summarizeExtraction } from '../../lib/extraction';
import {
  formatDateFull,
  formatINR,
  formatTime,
  parseExpenseDate,
  parseTimestamp,
} from '../../lib/format';
import { useReloadOnFocus } from '../../lib/hooks';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { AttachmentGrid, type AttachmentTile } from '../../components/ui/AttachmentGrid';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { Detail, DetailGrid } from '../../components/ui/Detail';
import { ExtractionFlags } from '../../components/ui/ExtractionFlags';
import { LineItemsCard } from '../../components/ui/LineItemsCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, InlineAlert, LoadingState } from '../../components/ui/States';

const RECEIPT_LABELS = {
  bill_photo: 'Bill photo',
  payment_screenshot: 'Payment screenshot',
  none: 'No receipt',
} as const;

const DECISION_SUCCESS: Record<ReviewDecisionAction, string> = {
  approve: 'Claim approved.',
  reject: 'Claim rejected.',
  request_info: 'Information requested. The claim is under review.',
};

const EMPLOYEE_INITIALS = EMPLOYEE_NAME.split(/\s+/)
  .map((part) => part[0])
  .slice(0, 2)
  .join('');

export function FinanceClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busyAction, setBusyAction] = useState<ReviewDecisionAction | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);

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
  const flags = useMemo(() => (summary ? extractionFlags(summary) : []), [summary]);

  const attachments: AttachmentTile[] = useMemo(() => {
    if (!expense) return [];
    return (expense.attachments || []).map((item) => ({
      id: item.id,
      url: attachmentUrl(expense.reference_id, item.id),
      name: item.filename || 'Attachment',
      mime: item.mime,
    }));
  }, [expense]);

  const primary = attachments[0];
  const restAttachments = attachments.slice(1);

  const decide = async (action: ReviewDecisionAction) => {
    if (!expense || busyAction) return;
    setDecisionError(null);
    setDecisionSuccess(null);

    const note = comment.trim();
    if ((action === 'reject' || action === 'request_info') && note.length < 3) {
      setDecisionError('Add a short comment before rejecting or requesting information.');
      return;
    }

    setBusyAction(action);
    try {
      const updated = await reviewExpense(
        expense.reference_id,
        action,
        note || undefined
      );
      setExpense((current) =>
        current
          ? {
              ...current,
              ...updated,
              attachments:
                updated.attachments && updated.attachments.length > 0
                  ? updated.attachments
                  : current.attachments,
            }
          : updated
      );
      setComment('');
      setDecisionSuccess(DECISION_SUCCESS[action]);
    } catch (reviewError) {
      setDecisionError(
        reviewError instanceof Error
          ? reviewError.message
          : 'Could not save the decision.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/finance"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong"
          aria-label="Back to claims"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-ink">
            Claim detail
          </h1>
          <p className="truncate font-mono text-[10px] text-ink-400">{id}</p>
        </div>
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
          <Card tone="dark" padding="md" className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-amber-400/10" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300">
                  <CategoryIcon category={expense.category} size={20} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cream/50">
                      {getCategoryLabel(expense.category)}
                    </p>
                    {expense.possible_duplicate ? (
                      <Badge tone="warning">Possible duplicate</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-base font-bold text-cream">
                    {expense.merchant || 'No bill claim'}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-cream/40">
                    {expense.reference_id}
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                <div className="sm:text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cream/40">
                    Claimed
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-[-0.02em] text-cream">
                    {formatINR(expense.amount_minor)}
                  </p>
                </div>
                <StatusBadge status={expense.review_status} />
              </div>
            </div>
            <div className="relative mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-3 text-[11px] text-cream/60 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-cream/40" />
                Expensed {formatDateFull(parseExpenseDate(expense.expense_date))}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 shrink-0 text-cream/40" />
                Submitted {formatDateFull(parseTimestamp(expense.created_at))} ·{' '}
                {formatTime(parseTimestamp(expense.created_at))}
              </span>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="min-w-0 space-y-4">
              <Card padding="sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
                      Bill & receipt
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {RECEIPT_LABELS[expense.receipt_type]}
                      {attachments.length > 1 ? ` · ${attachments.length} files` : ''}
                    </p>
                  </div>
                  {primary ? (
                    <a
                      href={primary.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-500 hover:text-ink"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                {primary ? (
                  primary.mime.startsWith('image/') ? (
                    <a
                      href={primary.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-line bg-cream"
                    >
                      <img
                        src={primary.url}
                        alt={primary.name}
                        className="max-h-[480px] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <a
                      href={primary.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-line bg-cream p-4 transition-colors hover:border-line-strong"
                    >
                      <FileText className="h-6 w-6 shrink-0 text-ink-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink">
                          {primary.name}
                        </span>
                        <span className="text-[10px] text-ink-400">PDF</span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-ink-400" />
                    </a>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-cream/60 px-4 py-10 text-center">
                    <FileText className="h-6 w-6 text-ink-400" />
                    <p className="mt-2 text-xs font-semibold text-ink">No receipt attached</p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      Review the entered fields and line items.
                    </p>
                  </div>
                )}

                {restAttachments.length > 0 ? (
                  <div className="mt-3">
                    <AttachmentGrid items={restAttachments} />
                  </div>
                ) : null}
              </Card>

              {flags.length > 0 ? (
                <ExtractionFlags summary={summary!} />
              ) : (
                <Card padding="sm" className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-ink">AI checks</p>
                    <p className="text-[10px] text-ink-400">No flags on this claim.</p>
                  </div>
                </Card>
              )}

              {summary ? (
                <LineItemsCard
                  items={summary.lineItems}
                  claimedAmountMinor={expense.amount_minor}
                />
              ) : null}
            </div>

            <div className="min-w-0 space-y-4">
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-amber-300">
                    {EMPLOYEE_INITIALS}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">
                      Submitted by
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                      {EMPLOYEE_NAME}
                    </p>
                    <p className="truncate text-[10px] text-ink-400">{EMPLOYEE_ROLE}</p>
                  </div>
                  <Badge tone="neutral" className="hidden sm:inline-flex">
                    Employee
                  </Badge>
                </div>
                <DetailGrid className="mt-3 border-t border-line-soft pt-3">
                  <Detail
                    label="Submitted on"
                    value={formatDateFull(parseTimestamp(expense.created_at))}
                  />
                  <Detail
                    label="Time"
                    value={formatTime(parseTimestamp(expense.created_at))}
                  />
                </DetailGrid>
              </Card>

              <Card padding="md" className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
                    Review decision
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-ink-400">
                    A comment is required to reject or request info.
                  </p>
                </div>

                {expense.reviewed_at ? (
                  <div className="flex items-start gap-2 rounded-xl border border-line-soft bg-cream/70 px-3 py-2">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-ink">
                        Last reviewed by {expense.reviewed_by || 'Finance'}
                      </p>
                      <p className="text-[9px] text-ink-400">
                        {formatDateFull(parseTimestamp(expense.reviewed_at))} ·{' '}
                        {formatTime(parseTimestamp(expense.reviewed_at))}
                      </p>
                    </div>
                  </div>
                ) : null}

                <Textarea
                  label="Comment"
                  optional
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Why this decision?"
                  rows={3}
                  maxLength={300}
                  disabled={busyAction !== null}
                />

                {decisionError ? (
                  <InlineAlert tone="error">{decisionError}</InlineAlert>
                ) : null}
                {decisionSuccess ? (
                  <InlineAlert tone="success">{decisionSuccess}</InlineAlert>
                ) : null}

                <div className="space-y-2">
                  <Button
                    variant="success"
                    fullWidth
                    onClick={() => void decide('approve')}
                    loading={busyAction === 'approve'}
                    disabled={busyAction !== null}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="amber"
                    fullWidth
                    onClick={() => void decide('request_info')}
                    loading={busyAction === 'request_info'}
                    disabled={busyAction !== null}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Request info
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={() => void decide('reject')}
                    loading={busyAction === 'reject'}
                    disabled={busyAction !== null}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </Card>

              <Card padding="md">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  Claim details
                </p>
                <DetailGrid className="mt-3">
                  <Detail
                    label="Expense date"
                    value={formatDateFull(parseExpenseDate(expense.expense_date))}
                  />
                  <Detail label="Receipt" value={RECEIPT_LABELS[expense.receipt_type]} />
                  <Detail label="Category" value={getCategoryLabel(expense.category)} />
                  <Detail label="Billable" value={expense.billable ? 'Yes' : 'No'} />
                  {expense.txn_ref ? (
                    <Detail label="Txn ref" value={expense.txn_ref} mono />
                  ) : null}
                  {expense.invoice_no ? (
                    <Detail label="Invoice" value={expense.invoice_no} mono />
                  ) : null}
                  {typeof expense.tax_amount_minor === 'number' &&
                  expense.tax_amount_minor > 0 ? (
                    <Detail
                      label="Tax"
                      value={formatINR(expense.tax_amount_minor)}
                    />
                  ) : null}
                </DetailGrid>

                <div className="mt-4 border-t border-line-soft pt-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">
                    Business purpose
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink">{expense.reason}</p>
                </div>

                {expense.review_note ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-600">
                      Finance note
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-ink-500">
                      {expense.review_note}
                    </p>
                  </div>
                ) : null}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
