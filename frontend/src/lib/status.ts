import type { ReviewStatus } from './api';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  dot: string;
}

/** One source of truth for status copy and badge tone in both sections. */
export function statusMeta(status: ReviewStatus | string): StatusMeta {
  switch (status) {
    case 'approved':
      return { label: 'Approved', tone: 'success', dot: 'bg-success-500' };
    case 'under_review':
      return { label: 'Under review', tone: 'warning', dot: 'bg-amber-500' };
    case 'rejected':
      return { label: 'Rejected', tone: 'danger', dot: 'bg-danger-500' };
    default:
      return { label: 'Submitted', tone: 'info', dot: 'bg-info-500' };
  }
}

export function isPending(status: ReviewStatus | string): boolean {
  return status === 'submitted' || status === 'under_review';
}
