const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const DEFAULT_TIMEOUT = 10000; // 10 seconds

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

export const CATEGORY_OPTIONS: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'cab_local_transport', label: 'Cab & local transport', icon: 'car-outline' },
  { key: 'travel', label: 'Travel (flights/train/hotel)', icon: 'airplane-outline' },
  { key: 'client_meals_entertainment', label: 'Client meals & entertainment', icon: 'wine-outline' },
  { key: 'team_meals', label: 'Team meals', icon: 'restaurant-outline' },
  { key: 'communication_data', label: 'Communication & data', icon: 'call-outline' },
  { key: 'office_supplies', label: 'Office & supplies', icon: 'briefcase-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

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
  attachment_ids?: string[];
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
  possible_duplicate: boolean;
  created_at: string;
  attachment_count: number;
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
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
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      },
      timeoutMs
    );

    if (!response.ok) {
      let detailMsg = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData?.detail) {
          detailMsg = typeof errorData.detail === 'string'
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

/**
 * Upload attachment files (images or PDFs, max 3).
 */
export async function uploadAttachmentFiles(
  files: File[],
  kind: 'bill' | 'payment_screenshot' | 'supporting' = 'bill'
): Promise<{ id: string; mime: string; filename: string; kind: string }[]> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f, f.name);
  }
  formData.append('kind', kind);

  const url = `${API_BASE_URL}/expenses/attachments`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let detail = 'Failed to upload files';
    try {
      const err = await response.json();
      if (err?.detail) {
        detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
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
  return request<ExpenseRecord>('/expenses', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
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
 * Fetch a single expense by ID or reference_id.
 */
export async function fetchExpenseById(identifier: string): Promise<ExpenseRecord> {
  return request<ExpenseRecord>(`/expenses/${encodeURIComponent(identifier)}`, {
    method: 'GET',
  });
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
  cached?: boolean;
}

/**
 * Auto-extract expense details using Gemini Flash.
 * Accepts 0-3 files and an optional user note.
 */
export async function extractExpense(
  files: File[],
  note?: string
): Promise<ExtractedDraft> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f, f.name);
  }
  if (note && note.trim()) {
    formData.append('note', note.trim());
  }

  const url = `${API_BASE_URL}/expenses/extract`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let detail = 'Extraction failed';
    try {
      const err = await response.json();
      if (err?.detail) {
        detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
      }
    } catch {}
    throw new Error(detail);
  }

  return response.json();
}

export { API_BASE_URL, request };
