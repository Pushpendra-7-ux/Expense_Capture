import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  FileText,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  CATEGORY_OPTIONS,
  EMPLOYEE_NAME,
  draftAttachmentUrl,
  submitExpense,
  type CategoryKey,
  type ExpensePayload,
} from '../../lib/api';
import { clearExtraction, recallExtraction, rememberSubmission } from '../../lib/draftStore';
import { makeFallbackDraft } from '../../lib/fallbackDraft';
import { summarizeExtraction } from '../../lib/extraction';
import { parseAmountToPaise, todayISO } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Input, Textarea } from '../../components/ui/Input';
import { InlineAlert } from '../../components/ui/States';
import { AttachmentGrid, type AttachmentTile } from '../../components/ui/AttachmentGrid';
import { LineItemsCard } from '../../components/ui/LineItemsCard';
import { ExtractionFlags } from '../../components/ui/ExtractionFlags';
import { Modal } from '../../components/ui/Modal';

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function EmployeeReviewPage() {
  const navigate = useNavigate();
  const draft = useMemo(() => recallExtraction(), []);
  const baseDraft = useMemo(
    () =>
      draft ||
      makeFallbackDraft({
        attachments: [],
        receiptType: 'none',
        notice: 'Enter the claim details.',
      }),
    [draft]
  );
  const summary = useMemo(() => summarizeExtraction(baseDraft), [baseDraft]);
  const keyRef = useRef(idempotencyKey());
  const editedRef = useRef(new Set<string>());

  const aiSucceeded = baseDraft.status === 'ok' || baseDraft.status === 'partial';
  const initialCategory = (() => {
    if (!baseDraft.fields.category) return '' as const;
    if (!aiSucceeded && baseDraft.fields.category === 'other') return '' as const;
    return baseDraft.fields.category;
  })();

  const [amount, setAmount] = useState(
    baseDraft.fields.amount_rupees ||
      (baseDraft.fields.amount_minor ? (baseDraft.fields.amount_minor / 100).toFixed(2) : '')
  );
  const [date, setDate] = useState(baseDraft.fields.expense_date || todayISO());
  const [merchant, setMerchant] = useState(baseDraft.fields.merchant || '');
  const [category, setCategory] = useState<CategoryKey | ''>(initialCategory);
  const [reason, setReason] = useState(baseDraft.fields.reason || '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const receiptType = baseDraft.receipt_type || 'none';
  const parsedPaise = parseAmountToPaise(amount);
  const confidence = summary.averageConfidence;

  const attachmentTiles: AttachmentTile[] = useMemo(() => {
    const attachments = baseDraft.attachments || [];
    return attachments.map((item) => ({
      id: item.id,
      url: item.id ? draftAttachmentUrl(item.id) : '',
      name: item.filename || 'Receipt',
      mime: item.mime,
    }));
  }, [baseDraft]);

  const mark = (field: string) => editedRef.current.add(field);

  const validate = (): string | null => {
    if (parsedPaise === null || parsedPaise <= 0) return 'Enter an amount above ₹0.';
    if (!date) return 'Pick an expense date.';
    if (date > todayISO()) return 'The date can’t be in the future.';
    if (receiptType !== 'none' && !merchant.trim()) return 'Add the merchant or payee.';
    if (!category) return 'Pick a category.';
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) return 'Add a short purpose.';
    if ((receiptType === 'none' || category === 'other') && cleanReason.length < 10) {
      return 'Describe the purpose in at least 10 characters.';
    }
    return null;
  };

  const submit = async (force = false) => {
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    const payload: ExpensePayload = {
      amount_minor: parsedPaise || 0,
      currency: 'INR',
      expense_date: date,
      merchant: receiptType === 'none' ? null : merchant.trim() || null,
      category: category as CategoryKey,
      reason: reason.trim(),
      receipt_type: receiptType,
      txn_ref: baseDraft.fields.txn_ref,
      invoice_no: baseDraft.fields.invoice_no,
      tax_amount_minor: baseDraft.fields.tax_amount_minor,
      extraction_status: aiSucceeded
        ? baseDraft.status === 'partial'
          ? 'partial'
          : 'ok'
        : 'manual',
      extraction_json: baseDraft as unknown as Record<string, unknown>,
      extracted_amount_minor: baseDraft.fields.amount_minor,
      extracted_date: baseDraft.fields.expense_date || null,
      extracted_merchant: baseDraft.fields.merchant,
      attachment_ids: baseDraft.attachment_ids || [],
      edited_fields: Array.from(editedRef.current),
    };

    try {
      const result = await submitExpense(payload, keyRef.current);
      if (result.possible_duplicate && !force) {
        setDuplicate(true);
        setSubmitting(false);
        return;
      }
      clearExtraction();
      rememberSubmission({
        referenceId: result.reference_id,
        amountPaise: result.amount_minor,
        merchant: result.merchant || 'Expense',
        id: result.reference_id,
      });
      setSubmitted(true);
      navigate('/employee/confirmation', { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Could not submit the claim.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Link
          to="/employee"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong"
          aria-label="Back to expenses"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">Review claim</h1>
          <p className="text-xs text-ink-400">
            {receiptType === 'none' ? 'No receipt' : 'Check the AI draft'}
          </p>
        </div>
        {aiSucceeded && confidence !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600">
            <Sparkles className="h-3 w-3" />
            {confidence}%
          </span>
        ) : null}
      </div>

      <Card padding="none" className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream text-ink-500">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Employee
            </p>
            <p className="truncate text-xs font-semibold text-ink">{EMPLOYEE_NAME}</p>
          </div>
          {attachmentTiles.length ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
              <FileText className="h-3.5 w-3.5" />
              {attachmentTiles.length} file{attachmentTiles.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </Card>

      {aiSucceeded ? (
        summary.notices.length || summary.conflicts.length ? (
          <ExtractionFlags summary={summary} />
        ) : null
      ) : baseDraft.notices.length > 0 ? (
        <InlineAlert tone="warning">{baseDraft.notices[0]}</InlineAlert>
      ) : null}

      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount"
            value={amount}
            onChange={(event) => {
              mark('amount');
              setAmount(event.target.value.replace(/[^0-9.]/g, ''));
            }}
            inputMode="decimal"
            placeholder="0.00"
            leading={<span className="text-xs font-bold text-ink-400">₹</span>}
            autoFocus={!baseDraft.fields.amount_rupees}
          />
          <Input
            label="Date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(event) => {
              mark('date');
              setDate(event.target.value);
            }}
          />
        </div>

        <Input
          label="Merchant or payee"
          optional={receiptType === 'none'}
          value={merchant}
          onChange={(event) => {
            mark('merchant');
            setMerchant(event.target.value);
          }}
          placeholder="e.g. Uber"
          maxLength={120}
        />

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                selected={category === option.key}
                onClick={() => {
                  mark('category');
                  setCategory(option.key);
                }}
                className="h-9"
              >
                {option.shortLabel}
              </Chip>
            ))}
          </div>
        </div>

        <Textarea
          label="Business purpose"
          value={reason}
          onChange={(event) => {
            mark('reason');
            setReason(event.target.value);
          }}
          placeholder="What was this for?"
          maxLength={140}
          rows={3}
        />
        <p className="-mt-2 text-right text-[10px] text-ink-400">{reason.length}/140</p>
      </Card>

      <LineItemsCard
        items={summary.lineItems}
        claimedAmountMinor={parsedPaise}
      />

      {attachmentTiles.length > 0 ? (
        <Card padding="md">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500">
              Attachments
            </p>
            <span className="text-[10px] text-ink-400">{attachmentTiles.length}</span>
          </div>
          <AttachmentGrid items={attachmentTiles} />
        </Card>
      ) : null}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-[520px]">
          <Button
            size="lg"
            fullWidth
            onClick={() => void submit()}
            loading={submitting}
            disabled={submitted}
          >
            <Check className="h-4 w-4" />
            {submitting ? 'Submitting…' : 'Submit expense'}
          </Button>
        </div>
      </div>

      <Modal
        open={duplicate}
        onClose={() => setDuplicate(false)}
        title="Possible duplicate"
        description="A similar claim is already in the ledger."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDuplicate(false)}>
              Review again
            </Button>
            <Button onClick={() => void submit(true)} loading={submitting}>
              Submit anyway
            </Button>
          </>
        }
      />
    </div>
  );
}
