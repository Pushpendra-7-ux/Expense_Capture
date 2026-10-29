import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { CATEGORY_OPTIONS, CategoryKey } from '../utils/api';

export type ExpenseFieldKey =
  | 'amount'
  | 'date'
  | 'merchant'
  | 'category'
  | 'reason';

interface ExpenseFieldsProps {
  amountStr: string;
  onAmountChange: (value: string) => void;
  expenseDate: string;
  onDateChange: (value: string) => void;
  onToday: () => void;
  merchant: string;
  onMerchantChange: (value: string) => void;
  category: CategoryKey | null;
  onCategoryChange: (value: CategoryKey) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  receiptType: 'bill_photo' | 'payment_screenshot' | 'none';
  aiFilled?: Partial<Record<ExpenseFieldKey, boolean>>;
  needsCheck?: Partial<Record<ExpenseFieldKey, boolean>>;
  disabled?: boolean;
  autoFocusAmount?: boolean;
}

function FieldHeader({
  label,
  required,
  hint,
  aiFilled,
  needsCheck,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  aiFilled?: boolean;
  needsCheck?: boolean;
}) {
  return (
    <View style={styles.fieldHeader}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>
          {label}
          {required ? ' *' : ''}
        </Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>

      {needsCheck ? (
        <View style={styles.checkPill}>
          <Ionicons
            name="alert-circle-outline"
            size={11}
            color={theme.colors.amberDeep}
          />
          <Text style={styles.checkPillText}>PLEASE CHECK</Text>
        </View>
      ) : aiFilled ? (
        <View style={styles.aiPill}>
          <Ionicons name="sparkles" size={10} color={theme.colors.amberDeep} />
          <Text style={styles.aiPillText}>AI</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ExpenseFields({
  amountStr,
  onAmountChange,
  expenseDate,
  onDateChange,
  onToday,
  merchant,
  onMerchantChange,
  category,
  onCategoryChange,
  reason,
  onReasonChange,
  receiptType,
  aiFilled = {},
  needsCheck = {},
  disabled = false,
  autoFocusAmount = false,
}: ExpenseFieldsProps) {
  const reasonMin = receiptType === 'none' || category === 'other' ? 10 : 3;

  const sanitizeAmount = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    if (rest.length === 0) return whole;
    return `${whole}.${rest.join('').slice(0, 2)}`;
  };

  return (
    <View>
      {/* Amount */}
      <View style={styles.fieldGroup}>
        <FieldHeader
          label="Amount"
          required
          aiFilled={aiFilled.amount}
          needsCheck={needsCheck.amount}
        />
        <View
          style={[
            styles.amountCard,
            needsCheck.amount && styles.needsCheckBorder,
          ]}
        >
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            value={amountStr}
            onChangeText={(value) => onAmountChange(sanitizeAmount(value))}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            editable={!disabled}
            autoFocus={autoFocusAmount}
            style={styles.amountInput}
            accessibilityLabel="Expense amount in rupees"
          />
          <View style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>INR</Text>
          </View>
        </View>
      </View>

      {/* Date */}
      <View style={styles.fieldGroup}>
        <FieldHeader
          label="Expense date"
          required
          aiFilled={aiFilled.date}
          needsCheck={needsCheck.date}
        />
        <View
          style={[
            styles.inputRow,
            needsCheck.date && styles.needsCheckBorder,
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={19}
            color={theme.colors.textSecondary}
            style={styles.inputIcon}
          />
          <TextInput
            value={expenseDate}
            onChangeText={onDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={10}
            editable={!disabled}
            style={styles.textInput}
            accessibilityLabel="Expense date"
          />
          <Pressable
            onPress={onToday}
            style={({ pressed }) => [
              styles.todayButton,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel="Use today's date"
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        </View>
      </View>

      {/* Merchant */}
      <View style={styles.fieldGroup}>
        <FieldHeader
          label="Merchant / payee"
          required={receiptType !== 'none'}
          hint={receiptType === 'none' ? 'Optional' : undefined}
          aiFilled={aiFilled.merchant}
          needsCheck={needsCheck.merchant}
        />
        <View
          style={[
            styles.inputRow,
            needsCheck.merchant && styles.needsCheckBorder,
          ]}
        >
          <Ionicons
            name="storefront-outline"
            size={19}
            color={theme.colors.textSecondary}
            style={styles.inputIcon}
          />
          <TextInput
            value={merchant}
            onChangeText={onMerchantChange}
            placeholder="e.g. Uber, Blue Tokai, Taj Hotel"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={200}
            editable={!disabled}
            style={styles.textInput}
            accessibilityLabel="Merchant or payee"
          />
        </View>
      </View>

      {/* Category */}
      <View style={styles.fieldGroup}>
        <FieldHeader
          label="Category"
          required
          aiFilled={aiFilled.category}
          needsCheck={needsCheck.category}
        />
        <View style={styles.chipGrid}>
          {CATEGORY_OPTIONS.map((option) => {
            const selected = category === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => onCategoryChange(option.key)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && { opacity: 0.78 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
              >
                <Ionicons
                  name={option.icon as any}
                  size={15}
                  color={
                    selected ? theme.colors.amberOnDark : theme.colors.iconInk
                  }
                />
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {option.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Reason */}
      <View style={[styles.fieldGroup, styles.lastFieldGroup]}>
        <FieldHeader
          label="Business purpose"
          required
          hint={`Min ${reasonMin} chars`}
          aiFilled={aiFilled.reason}
          needsCheck={needsCheck.reason}
        />
        <TextInput
          value={reason}
          onChangeText={onReasonChange}
          placeholder="e.g. Client debrief with the founders at BKC office"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={3}
          maxLength={500}
          editable={!disabled}
          style={[
            styles.reasonInput,
            needsCheck.reason && styles.needsCheckBorder,
          ]}
          accessibilityLabel="Business purpose"
        />
        <Text style={styles.reasonCounter}>{reason.length}/500</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: theme.spacing.xl,
  },
  lastFieldGroup: {
    marginBottom: theme.spacing.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    minHeight: 18,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  fieldHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  aiPillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.colors.amberDeep,
  },
  checkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  checkPillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.55,
    color: theme.colors.amberDeep,
  },

  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: 16,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  rupee: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.textPrimary,
    paddingVertical: 12,
  },
  currencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceAlt,
  },
  currencyPillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    paddingVertical: 12,
  },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  todayButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: theme.colors.textSecondary,
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  chipText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  chipTextSelected: {
    color: theme.colors.white,
  },

  reasonInput: {
    minHeight: 104,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  reasonCounter: {
    alignSelf: 'flex-end',
    marginTop: 5,
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  needsCheckBorder: {
    borderColor: theme.colors.amber,
    borderWidth: 1.5,
  },
});
