import type { ExtractedDraft } from './api';

/**
 * The review screen receives only the editable fields via route params. The
 * full Gemini draft is kept here so the finance console can later show exactly
 * what the model read, including confidence and notices.
 */
let latestDraft: ExtractedDraft | null = null;

const STORAGE_KEY = 'ope_latest_extraction';

export function rememberExtraction(draft: ExtractedDraft | null): void {
  latestDraft = draft;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      if (draft) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Session storage can be unavailable in private browsing.
    }
  }
}

export function recallExtraction(): ExtractedDraft | null {
  if (latestDraft) return latestDraft;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        latestDraft = JSON.parse(raw) as ExtractedDraft;
        return latestDraft;
      }
    } catch {
      // Ignore malformed or unavailable storage.
    }
  }
  return null;
}

export function clearExtraction(): void {
  latestDraft = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }
}
