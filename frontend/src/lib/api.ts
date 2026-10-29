export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://expense-capture-1.onrender.com'
).replace(/\/$/, '');

const DEFAULT_TIMEOUT = 15000;

export type CategoryKey =
  | 'cab_local_transport'
  | 'travel'
  | 'client_meals_entertainment'
  | 'team_meals'
  | 'communication_data'
  | 'office_supplies'
  | 'other';

export type ReviewStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export type ReviewDecisionAction = 'approve' | 'reject' | 'request_info';

export interface CategoryOption {
  key: CategoryKey;
  label: string;
  shortLabel: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: 'cab_local_transport', label: 'Travel & Ground Transit', shortLabel: 'Cabs' },
  { key: 'travel', label: 'Flights & Hotels', shortLabel: 'Travel' },
  {
    key: 'client_meals_entertainment',
    label: 'Client Entertainment',
    shortLabel: 'Client',
  },
  { key: 'team_meals', label: 'Meals & Dining', shortLabel: 'Meals' },
  { key: 'communication_data', label: 'Comms & Data', shortLabel: 'Comms' },
  { key: 'office_supplies', label: 'Office & Supplies', shortLabel: 'Office' },
  { key: 'other', label: 'Other', shortLabel: 'Other' },
];

export function getCategoryOption(key?: string | null): CategoryOption | undefined {
  return CATEGORY_OPTIONS.find((option) => option.key === key);
}

export function getCategoryLabel(key?: string | null): string {
  return getCategoryOption(key)?.label || key || 'Other';
}

export interface CategoryFilter {
  key: string;
  label: string;
  categories: CategoryKey[] | null;
}

export const CATEGORY_FILTERS: CategoryFilter[] = [
  { key: 'all', label: 'All', categories: null },
  { key: 'meals', label: 'Meals', categories: ['team_meals'] },
  {
    key: 'travel',
    label: 'Travel',
    categories: ['cab_local_transport', 'travel'],
  },
  {
    key: 'client',
    label: 'Client',
    categories: ['client_meals_entertainment'],
  },
  {
    key: 'office',
    label: 'Office',
    categories: ['office_supplies', 'communication_data'],
  },
  { key: 'other', label: 'Other', categories: ['other'] },
];

export interface AttachmentRecord {
  id: string;
  mime: string;
  filename: string | null;
  kind: string;
}

export interface ExpenseRecord {
  id: string;
  reference_id: string;
  user_id: string;
  amount_minor: number;
  currency: string;
  expense_date: string;
  merchant: string | null;
  category: CategoryKey;
  category_label: string;
  reason: string;
  receipt_type: 'bill_photo' | 'payment_screenshot' | 'none';
  txn_ref: string | null;
  invoice_no: string | null;
  tax_amount_minor: number | null;
  extraction_status: 'ok' | 'partial' | 'failed' | 'manual';
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  billable: boolean;
  possible_duplicate: boolean;
  extraction_json?: Record<string, unknown> | null;
  created_at: string;
  attachment_count: number;
  attachments?: AttachmentRecord[];
}

export interface ExpenseListResponse {
  items: ExpenseRecord[];
  next_cursor: string | null;
  has_more: boolean;
  total_count: number;
}

export interface ExpensePayload {
  amount_minor: number;
  currency: string;
  expense_date: string;
  merchant: string | null;
  category: CategoryKey;
  reason: string;
  receipt_type: 'bill_photo' | 'payment_screenshot' | 'none';
  txn_ref?: string | null;
  invoice_no?: string | null;
  tax_amount_minor?: number | null;
  extraction_status: 'ok' | 'partial' | 'failed' | 'manual';
  extraction_json: Record<string, unknown> | null;
  extracted_amount_minor: number | null;
  extracted_date: string | null;
  extracted_merchant: string | null;
  attachment_ids: string[];
  edited_fields: string[];
}

export interface ExtractedLineItem {
  description: string;
  amount?: number | null;
  amount_minor?: number | null;
}

export interface ExtractedDraft {
  status: 'ok' | 'partial' | 'failed' | 'manual';
  fields: {
    amount_minor: number | null;
    amount_rupees: string;
    expense_date: string;
    merchant: string | null;
    category: CategoryKey;
    reason: string;
    receipt_type: 'bill_photo' | 'payment_screenshot' | 'none';
    txn_ref: string | null;
    invoice_no: string | null;
    tax_amount_minor: number | null;
  };
  confidence: {
    amount: number;
    date: number;
    merchant: number;
    category: number;
    reason: number;
  };
  receipt_type: 'bill_photo' | 'payment_screenshot' | 'none';
  conflicts: string[];
  cross_checks?: Record<string, string>;
  reason_suggestion?: string | null;
  notices: string[];
  attachment_ids: string[];
  attachments?: AttachmentRecord[];
  line_items?: ExtractedLineItem[];
  line_items_total?: number | null;
  raw_extraction?: Record<string, unknown> | null;
  cached?: boolean;
}

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function errorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (payload?.detail) {
      return typeof payload.detail === 'string'
        ? payload.detail
        : JSON.stringify(payload.detail);
    }
  } catch {
    // Non-JSON error body.
  }
  return fallback;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      timeoutMs
    );

    if (!response.ok) {
      const detail = await errorDetail(response, response.statusText);
      throw new ApiError(detail, response.status, detail);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The server took too long to respond. Try again.');
    }
    throw new Error(
      error instanceof Error ? error.message : 'Could not reach the server.'
    );
  }
}

export async function checkHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health', { method: 'GET' });
}

export async function fetchExpenses(
  cursor?: string | null,
  limit: number = 30
): Promise<ExpenseListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(Math.min(limit, 100)));
  return request<ExpenseListResponse>(`/expenses?${params.toString()}`, {
    method: 'GET',
  });
}

export async function fetchAllExpenses(
  pageSize: number = 100,
  maxRecords: number = 5000
): Promise<ExpenseRecord[]> {
  const items: ExpenseRecord[] = [];
  let cursor: string | null = null;

  while (items.length < maxRecords) {
    const page = await fetchExpenses(cursor, pageSize);
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor || page.next_cursor === cursor) break;
    cursor = page.next_cursor;
  }

  return items.slice(0, maxRecords);
}

export async function fetchExpenseById(identifier: string): Promise<ExpenseRecord> {
  return request<ExpenseRecord>(`/expenses/${encodeURIComponent(identifier)}`, {
    method: 'GET',
  });
}

export async function reviewExpense(
  identifier: string,
  action: ReviewDecisionAction,
  note?: string,
  reviewer: string = 'Finance Team • OPE'
): Promise<ExpenseRecord> {
  return request<ExpenseRecord>(
    `/expenses/${encodeURIComponent(identifier)}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action, note: note?.trim() || null, reviewer }),
    },
    30000
  );
}

export interface UploadFileInput {
  file: File;
  name: string;
  mime: string;
}

export async function uploadAttachmentFiles(
  files: UploadFileInput[],
  kind: 'bill' | 'payment_screenshot' | 'supporting' = 'bill'
): Promise<AttachmentRecord[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file.file, file.name));
  formData.append('kind', kind);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/expenses/attachments`,
      { method: 'POST', body: formData },
      35000
    );
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Could not upload the files.'
    );
  }

  if (!response.ok) {
    throw new Error(await errorDetail(response, 'Could not upload the files.'));
  }
  return response.json();
}

export async function extractExpense(
  files: UploadFileInput[],
  note?: string,
  attachmentKind: 'bill' | 'payment_screenshot' | 'supporting' = 'bill'
): Promise<ExtractedDraft> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file.file, file.name));
  if (note?.trim()) formData.append('note', note.trim());
  if (attachmentKind !== 'bill') {
    formData.append('attachment_kind', attachmentKind);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/expenses/extract`,
      { method: 'POST', body: formData },
      45000
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Reading the bill took too long. Try again or enter it manually.');
    }
    throw new Error(
      error instanceof Error ? error.message : 'Could not reach the extraction service.'
    );
  }

  if (!response.ok) {
    throw new Error(await errorDetail(response, 'Could not read the bill.'));
  }
  return response.json();
}

export async function submitExpense(
  payload: ExpensePayload,
  idempotencyKey: string
): Promise<ExpenseRecord> {
  return request<ExpenseRecord>(
    '/expenses',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    },
    30000
  );
}

export function attachmentUrl(identifier: string, attachmentId: string): string {
  return `${API_BASE_URL}/expenses/${encodeURIComponent(
    identifier
  )}/attachments/${attachmentId}`;
}

export function draftAttachmentUrl(attachmentId: string): string {
  return `${API_BASE_URL}/attachments/${attachmentId}`;
}

export const EMPLOYEE_NAME = 'Pushpendra Suryawanshi';
export const EMPLOYEE_ROLE = 'Investment Banking · OPE';
