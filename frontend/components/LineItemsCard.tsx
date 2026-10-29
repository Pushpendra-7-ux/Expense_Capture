import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { formatINR } from '../utils/format';
import type { ExtractedLineItemView } from '../utils/extraction';

interface LineItemsCardProps {
  items: ExtractedLineItemView[];
  claimedAmountMinor?: number | null;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

/**
 * Displays every line item Gemini read from an itemized bill. Long receipts
 * (10+ entries) are rendered in full so the employee can verify the draft and
 * finance can reconcile the claim before approving it.
 */
export function LineItemsCard({
  items,
  claimedAmountMinor,
  title = 'ITEMIZED RECEIPT',
  subtitle,
  compact = false,
}: LineItemsCardProps) {
  if (items.length === 0) return null;

  const totalMinor = items.reduce(
    (sum, item) => sum + (item.amountMinor || 0),
    0
  );
  const allAmountsRead = items.every(
    (item) => item.amountMinor !== null && item.amountMinor !== undefined
  );
  const claimPaise =
    typeof claimedAmountMinor === 'number' && claimedAmountMinor > 0
      ? claimedAmountMinor
      : null;
  const mismatch =
    allAmountsRead &&
    claimPaise !== null &&
    Math.abs(totalMinor - claimPaise) > 100;
  const itemLabel = items.length === 1 ? '1 line item' : `${items.length} line items`;
  const subtitleText =
    subtitle ||
    (allAmountsRead
      ? `${itemLabel} read by Gemini`
      : `${itemLabel} read • ${items.filter((item) => item.amountMinor === null).length} without an amount`);

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons
            name="receipt-outline"
            size={compact ? 14 : 16}
            color={theme.colors.amberDeep}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </View>
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>{formatINR(totalMinor)}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {items.map((item, index) => (
          <View
            key={`${item.description}-${index}`}
            style={[styles.row, index === items.length - 1 && styles.rowLast]}
          >
            <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.amount}>
              {item.amountMinor !== null
                ? formatINR(item.amountMinor)
                : '—'}
            </Text>
          </View>
        ))}
      </View>

      {mismatch ? (
        <View style={styles.warning}>
          <Ionicons
            name="alert-circle-outline"
            size={13}
            color={theme.colors.amberDeep}
          />
          <Text style={styles.warningText}>
            Line items total {formatINR(totalMinor)}, but the claim reads{' '}
            {formatINR(claimPaise)}. Verify the amount and entries.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    padding: 12,
    marginTop: 14,
  },
  cardCompact: {
    padding: 10,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  icon: {
    width: 29,
    height: 29,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textSecondary,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 13,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  totalPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  totalText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  list: {
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 31,
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  index: {
    width: 17,
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  description: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textPrimary,
  },
  amount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 9,
    padding: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  warningText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    color: theme.colors.textSecondary,
  },
});
