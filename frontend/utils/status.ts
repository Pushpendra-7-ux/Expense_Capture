import { theme } from '../theme';
import type { ReviewStatus } from './api';

export interface ReviewStatusStyle {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

/**
 * One source of truth for claim status colours across the employee feed,
 * expense detail, and finance console.
 */
export function reviewStatusMeta(status: ReviewStatus): ReviewStatusStyle {
  switch (status) {
    case 'approved':
      return {
        label: 'APPROVED',
        color: theme.colors.success,
        backgroundColor: theme.colors.successSoft,
        borderColor: theme.colors.successBorder,
      };
    case 'under_review':
      return {
        label: 'UNDER REVIEW',
        color: theme.colors.amberDeep,
        backgroundColor: theme.colors.amberSoft,
        borderColor: theme.colors.amberBorder,
      };
    case 'rejected':
      return {
        label: 'REJECTED',
        color: theme.colors.error,
        backgroundColor: theme.colors.errorSoft,
        borderColor: theme.colors.errorBorder,
      };
    default:
      return {
        label: 'SUBMITTED',
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.surfaceAlt,
        borderColor: theme.colors.border,
      };
  }
}

export function reviewStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'under_review':
      return 'Under review';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Submitted';
  }
}
