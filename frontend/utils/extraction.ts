export interface ExtractionFieldView {
  amount: string;
  date: string;
  merchant: string;
  category: string;
  reason: string;
  txnRef: string;
  invoiceNo: string;
  tax: string;
}

export interface ExtractedLineItemView {
  description: string;
  amount: number | null;
  amountMinor: number | null;
}

export interface ExtractionSummary {
  status: string | null;
  averageConfidence: number | null;
  confidence: Record<string, number>;
  fields: ExtractionFieldView;
  lineItems: ExtractedLineItemView[];
  lineItemsTotalMinor: number | null;
  notices: string[];
  conflicts: string[];
  crossChecks: Record<string, string>;
  raw: Record<string, any> | null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function amountFromUnknown(value: unknown): number | null {
  const direct = numberOrNull(value);
  if (direct !== null) return direct;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned || (cleaned.match(/\./g) || []).length > 1) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLineItems(source: Record<string, any> | null): ExtractedLineItemView[] {
  const candidates = [
    source?.line_items,
    source?.raw_extraction?.line_items,
    source?.fields?.line_items,
  ].find((value) => Array.isArray(value));
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((item: any, index: number): ExtractedLineItemView | null => {
      if (!item || typeof item !== 'object') return null;
      const description = String(
        item.description || item.name || item.item || item.label || `Item ${index + 1}`
      ).trim();
      let amount = amountFromUnknown(
        item.amount ?? item.total ?? item.line_total ?? item.price ?? item.value
      );
      const amountMinorRaw = numberOrNull(item.amount_minor);
      if (amount === null && amountMinorRaw !== null) {
        amount = amountMinorRaw / 100;
      }
      if (amount !== null && amount < 0) return null;
      return {
        description: description || `Item ${index + 1}`,
        amount,
        amountMinor:
          amountMinorRaw !== null
            ? Math.round(amountMinorRaw)
            : amount !== null
            ? Math.round(amount * 100)
            : null,
      };
    })
    .filter((item: ExtractedLineItemView | null): item is ExtractedLineItemView => item !== null);
}

/**
 * Turns the stored Gemini draft into display-safe values. Older claims have no
 * extraction payload, so every field degrades to an empty value.
 */
export function summarizeExtraction(json: unknown): ExtractionSummary {
  const source =
    json && typeof json === 'object' ? (json as Record<string, any>) : null;
  const fields =
    source?.fields && typeof source.fields === 'object'
      ? (source.fields as Record<string, any>)
      : {};
  const rawConfidence =
    source?.confidence && typeof source.confidence === 'object'
      ? (source.confidence as Record<string, unknown>)
      : {};

  const confidence: Record<string, number> = {};
  Object.entries(rawConfidence).forEach(([key, value]) => {
    const n = numberOrNull(value);
    if (n !== null) confidence[key] = n;
  });

  const values = Object.values(confidence);
  const averageConfidence = values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100)
    : null;

  const rawCross =
    source?.cross_checks && typeof source.cross_checks === 'object'
      ? (source.cross_checks as Record<string, unknown>)
      : {};
  const crossChecks: Record<string, string> = {};
  Object.entries(rawCross).forEach(([key, value]) => {
    if (typeof value === 'string') crossChecks[key] = value;
  });

  const amountValue =
    fields.amount_rupees ||
    (typeof fields.amount_minor === 'number'
      ? (fields.amount_minor / 100).toFixed(2)
      : '');

  const lineItems = normalizeLineItems(source);
  const lineItemsTotalMinor = lineItems.length
    ? lineItems.reduce((sum, item) => sum + (item.amountMinor || 0), 0)
    : null;

  return {
    status: typeof source?.status === 'string' ? source.status : null,
    averageConfidence,
    confidence,
    fields: {
      amount: String(amountValue || ''),
      date: String(fields.expense_date || ''),
      merchant: String(fields.merchant || ''),
      category: String(fields.category || ''),
      reason: String(fields.reason || ''),
      txnRef: String(fields.txn_ref || ''),
      invoiceNo: String(fields.invoice_no || ''),
      tax:
        typeof fields.tax_amount_minor === 'number' && fields.tax_amount_minor > 0
          ? String(fields.tax_amount_minor / 100)
          : '',
    },
    lineItems,
    lineItemsTotalMinor,
    notices: Array.isArray(source?.notices)
      ? source.notices.filter((item: unknown): item is string => typeof item === 'string')
      : [],
    conflicts: Array.isArray(source?.conflicts)
      ? source.conflicts.filter(
          (item: unknown): item is string => typeof item === 'string'
        )
      : [],
    crossChecks,
    raw: source,
  };
}
