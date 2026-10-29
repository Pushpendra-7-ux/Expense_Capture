import type { ExtractedDraft } from './api';

const DRAFT_KEY = 'ope_web_draft';
const SUBMISSION_KEY = 'ope_web_submission';

export interface ConfirmationState {
  referenceId: string;
  amountPaise: number;
  merchant: string;
  id: string;
}

export function rememberExtraction(draft: ExtractedDraft | null): void {
  try {
    if (draft) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } else {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export function recallExtraction(): ExtractedDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ExtractedDraft) : null;
  } catch {
    return null;
  }
}

export function clearExtraction(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore.
  }
}

export function rememberSubmission(state: ConfirmationState): void {
  try {
    sessionStorage.setItem(SUBMISSION_KEY, JSON.stringify(state));
  } catch {
    // Ignore.
  }
}

export function recallSubmission(): ConfirmationState | null {
  try {
    const raw = sessionStorage.getItem(SUBMISSION_KEY);
    return raw ? (JSON.parse(raw) as ConfirmationState) : null;
  } catch {
    return null;
  }
}
