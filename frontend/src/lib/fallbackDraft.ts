import type { AttachmentRecord, ExtractedDraft } from './api';
import { todayISO } from './format';

export function makeFallbackDraft({
  attachments,
  receiptType,
  reason = '',
  notice,
}: {
  attachments: AttachmentRecord[];
  receiptType: 'bill_photo' | 'payment_screenshot' | 'none';
  reason?: string;
  notice?: string;
}): ExtractedDraft {
  return {
    status: 'failed',
    fields: {
      amount_minor: null,
      amount_rupees: '',
      expense_date: todayISO(),
      merchant: null,
      category: 'other',
      reason,
      receipt_type: receiptType,
      txn_ref: null,
      invoice_no: null,
      tax_amount_minor: null,
    },
    confidence: { amount: 0, date: 0.5, merchant: 0, category: 0, reason: 0 },
    receipt_type: receiptType,
    conflicts: [],
    notices: [
      notice ||
        (attachments.length
          ? 'AI could not read this file. Add the details manually.'
          : 'Add the details manually.'),
    ],
    attachment_ids: attachments.map((item) => item.id),
    attachments,
    line_items: [],
    line_items_total: null,
  };
}
