const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const DEFAULT_TIMEOUT = 15000; // 15 seconds

export interface HealthResponse {
  status: string;
  timestamp: string;
}

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

export const CATEGORY_OPTIONS: {
  key: CategoryKey;
  label: string;
  shortLabel: string;
  icon: string;
}[] = [
  {
    key: 'cab_local_transport',
    label: 'Travel & Ground Transit',
    shortLabel: 'Cabs & Travel',
    icon: 'car-outline',
  },
  {
    key: 'travel',
    label: 'Flights & Hotels',
    shortLabel: 'Flights & Hotels',
    icon: 'airplane-outline',
  },
  {
    key: 'client_meals_entertainment',
    label: 'Client Entertainment',
    shortLabel: 'Client',
    icon: 'wine-outline',
  },
  {
    key: 'team_meals',
    label: 'Meals & Dining',
    shortLabel: 'Meals & Dining',
    icon: 'restaurant-outline',
  },
  {
    key: 'communication_data',
    label: 'Comms & Data',
    shortLabel: 'Comms & Data',
    icon: 'phone-portrait-outline',
  },
  {
    key: 'office_supplies',
    label: 'Office & Supplies',
    shortLabel: 'Office',
    icon: 'briefcase-outline',
  },
  {
    key: 'other',
    label: 'Other',
    shortLabel: 'Other',
    icon: 'ellipsis-horizontal-outline',
  },
];

export interface CategoryFilter {
  key: string;
  label: string;
  categories: CategoryKey[] | null;
}

export const CATEGORY_FILTERS: CategoryFilter[] = [
  { key: 'all', label: 'ALL', categories: null },
  { key: 'meals', label: 'MEALS & DINING', categories: ['team_meals'] },
  {
    key: 'travel',
    label: 'CABS & TRAVEL',
    categories: ['cab_local_transport', 'travel'],
  },
  {
    key: 'client',
    label: 'CLIENT',
    categories: ['client_meals_entertainment'],
  },
  {
    key: 'office',
    label: 'OFFICE',
    categories: ['office_supplies', 'communication_data'],
  },
  { key: 'other', label: 'OTHER', categories: ['other'] },
];

export function getCategoryOption(key?: string) {
  return CATEGORY_OPTIONS.find((c) => c.key === key);
}

export function getCategoryLabel(key?: string) {
  return getCategoryOption(key)?.label || key || 'Other';
}

export function getCategoryIcon(key?: string): string {
  return getCategoryOption(key)?.icon || 'receipt-outline';
}

export interface ExpensePayload {
  amount_minor: number;
  currency?: string;
  expense_date: string; // YYYY-MM-DD
  merchant?: string | null;
  category: CategoryKey;
  reason: string;
  receipt_type: 'bill_photo' | 'payment_screenshot' | 'none';
  txn_ref?: string | null;
  invoice_no?: string | null;
  tax_amount_minor?: number | null;
  extraction_status?: 'ok' | 'partial' | 'failed' | 'manual';
  extraction_json?: Record<string, any> | null;
  extracted_amount_minor?: number | null;
  extracted_date?: string | null;
  extracted_merchant?: string | null;
  attachment_ids?: string[];
  edited_fields?: string[];
}

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
  extraction_json?: Record<string, any> | null;
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

/**
 * Files arrive either as browser File objects (web) or native asset URIs.
 * Keeping one shape lets the capture screens share the rest of the pipeline.
 */
export interface UploadFileInput {
  file?: File;
  uri?: string;
  name: string;
  mime: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetchWithTimeout(
      url,
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
      let detailMsg = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData?.detail) {
          detailMsg =
            typeof errorData.detail === 'string'
              ? errorData.detail
              : JSON.stringify(errorData.detail);
        }
      } catch {
        // non-json error response
      }
      throw new ApiError(detailMsg, response.status, detailMsg);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw new Error(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function appendUpload(formData: FormData, f: UploadFileInput) {
  if (f.file) {
    formData.append('files', f.file, f.name);
    return;
  }
  if (f.uri) {
    // React Native's FormData accepts a file descriptor object.
    formData.append('files', {
      uri: f.uri,
      name: f.name,
      type: f.mime,
    } as any);
  }
}

/**
 * Upload attachment files (images or PDFs, max 3).
 */
export async function uploadAttachmentFiles(
  files: UploadFileInput[],
  kind: 'bill' | 'payment_screenshot' | 'supporting' = 'bill'
): Promise<AttachmentRecord[]> {
  const formData = new FormData();
  for (const f of files) appendUpload(formData, f);
  formData.append('kind', kind);

  const url = `${API_BASE_URL}/expenses/attachments`;
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      body: formData,
    },
    35000
  );

  if (!response.ok) {
    let detail = 'Failed to upload files';
    try {
      const err = await response.json();
      if (err?.detail) {
        detail =
          typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
      }
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}

/**
 * Check the server health endpoint.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { method: 'GET' }, 15000);
}

/**
 * Submit an expense claim (Idempotent).
 */
export async function submitExpense(
  payload: ExpensePayload,
  idempotencyKey: string
): Promise<ExpenseRecord> {
  return request<ExpenseRecord>(
    '/expenses',
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
    30000
  );
}

/**
 * List expenses with cursor pagination.
 */
export async function fetchExpenses(
  cursor?: string | null,
  limit: number = 20
): Promise<ExpenseListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  params.append('limit', String(limit));
  return request<ExpenseListResponse>(`/expenses?${params.toString()}`, {
    method: 'GET',
  });
}

/**
 * Load every claim for the finance ledger. The API pages at 100 records, so a
 * busy workspace needs more than the first page to show all employee claims.
 */
export async function fetchAllExpenses(
  pageSize: number = 100,
  maxRecords: number = 5000
): Promise<ExpenseRecord[]> {
  const items: ExpenseRecord[] = [];
  let cursor: string | null = null;

  while (items.length < maxRecords) {
    const page = await fetchExpenses(cursor, pageSize);
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor) break;
    if (page.next_cursor === cursor) break;
    cursor = page.next_cursor;
  }

  return items.slice(0, maxRecords);
}

/**
 * Fetch a single expense by ID or reference_id.
 */
export async function fetchExpenseById(identifier: string): Promise<ExpenseRecord> {
  return request<ExpenseRecord>(`/expenses/${encodeURIComponent(identifier)}`, {
    method: 'GET',
  });
}

export type ReviewDecisionAction = 'approve' | 'reject';

/**
 * Finance team decision: approve or reject a claim.
 * No authentication in this build — the finance console supplies the reviewer
 * label used for the audit trail.
 */
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

/**
 * Auto-extract expense details using Gemini Flash.
 * Accepts 0-3 files and an optional user note. File upload and extraction are
 * one round-trip so a failed AI analysis still leaves the attachments saved.
 */
export async function extractExpense(
  files: UploadFileInput[],
  note?: string,
  attachmentKind: 'bill' | 'payment_screenshot' | 'supporting' = 'bill'
): Promise<ExtractedDraft> {
  const formData = new FormData();
  for (const f of files) appendUpload(formData, f);
  if (note && note.trim()) {
    formData.append('note', note.trim());
  }
  if (attachmentKind !== 'bill') {
    formData.append('attachment_kind', attachmentKind);
  }

  const url = `${API_BASE_URL}/expenses/extract`;
  // The backend enforces a 20s end-to-end extraction budget; allow a little
  // extra for upload time on a phone connection.
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        body: formData,
      },
      45000
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Reading the bill took too long. Please try again or enter it manually.');
    }
    throw new Error(
      `Could not reach the extraction service: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  if (!response.ok) {
    let detail = 'Extraction failed';
    try {
      const err = await response.json();
      if (err?.detail) {
        detail =
          typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
      }
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}

export { API_BASE_URL, request };
