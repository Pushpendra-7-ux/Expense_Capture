import React, { useState, useEffect, useId } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import {
  submitExpense,
  CategoryKey,
  CATEGORY_OPTIONS,
  ExpensePayload,
  API_BASE_URL,
} from '../utils/api';
import { formatINR } from '../utils/format';
import { PDFCard } from '../components/PDFCard';

// Helper to generate a unique client-side idempotency key
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'draft-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
}

// Format Date object to YYYY-MM-DD
function toYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    receiptType?: 'bill_photo' | 'payment_screenshot' | 'none';
    amount?: string;
    merchant?: string;
    date?: string;
    category?: CategoryKey;
    reason?: string;
    attachmentIds?: string;
    confidence?: string;
    notices?: string;
    conflicts?: string;
  }>();

  const { width } = useWindowDimensions();
  const containerMaxWidth = width > 460 ? 420 : width;

  // Attached files state
  const [attachmentIds, setAttachmentIds] = useState<string[]>(() => {
    if (!params.attachmentIds) return [];
    try {
      const parsed = JSON.parse(params.attachmentIds);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Extraction confidence and notices
  const confidence = (() => {
    try {
      return params.confidence ? JSON.parse(params.confidence) : {};
    } catch {
      return {};
    }
  })();

  const notices: string[] = (() => {
    try {
      return params.notices ? JSON.parse(params.notices) : [];
    } catch {
      return [];
    }
  })();

  const conflicts: string[] = (() => {
    try {
      return params.conflicts ? JSON.parse(params.conflicts) : [];
    } catch {
      return [];
    }
  })();

  // Form State — EXACTLY five fields
  const [receiptType, setReceiptType] = useState<'bill_photo' | 'payment_screenshot' | 'none'>(
    (params.receiptType as any) || (attachmentIds.length > 0 ? 'bill_photo' : 'none')
  );
  const [amountStr, setAmountStr] = useState<string>(params.amount || '');
  const [expenseDate, setExpenseDate] = useState<string>(
    params.date || toYYYYMMDD(new Date())
  );
  const [merchant, setMerchant] = useState<string>(params.merchant || '');
  const [category, setCategory] = useState<CategoryKey | null>(
    (params.category as CategoryKey) || null
  );
  const [reason, setReason] = useState<string>(params.reason || '');

  // Tracking edited fields for audit metadata
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  const markEdited = (fieldName: string) => {
    setEditedFields((prev) => new Set(prev).add(fieldName));
  };

  const isLowConfAmount =
    confidence.amount !== undefined &&
    confidence.amount < 0.6 &&
    !editedFields.has('amount');
  const isLowConfDate =
    confidence.date !== undefined &&
    confidence.date < 0.6 &&
    !editedFields.has('date');
  const isLowConfMerchant =
    confidence.merchant !== undefined &&
    confidence.merchant < 0.6 &&
    !editedFields.has('merchant');
  const isLowConfCategory =
    confidence.category !== undefined &&
    confidence.category < 0.6 &&
    !editedFields.has('category');
  const isLowConfReason =
    confidence.reason !== undefined &&
    confidence.reason < 0.6 &&
    !editedFields.has('reason');

  // UI / Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);
  const [idempotencyKey] = useState<string>(() => generateIdempotencyKey());

  // In-progress draft persistence in local state / sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const draft = {
          amountStr,
          expenseDate,
          merchant,
          category,
          reason,
          receiptType,
          attachmentIds,
        };
        window.sessionStorage.setItem('ope_active_draft', JSON.stringify(draft));
      } catch {}
    }
  }, [amountStr, expenseDate, merchant, category, reason, receiptType, attachmentIds]);

  // Convert amount string to integer paise
  const parsedPaise = Math.round((parseFloat(amountStr) || 0) * 100);

  // Client-side Validation
  const validateForm = (): string | null => {
    // 1. Amount
    if (isNaN(parsedPaise) || parsedPaise <= 0) {
      return 'Please enter a valid amount greater than ₹0';
    }
    if (parsedPaise > 100_000_000) {
      return 'Amount exceeds maximum allowable limit of ₹10,00,000';
    }

    // 2. Date
    if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      return 'Date must be in YYYY-MM-DD format';
    }
    const todayStr = toYYYYMMDD(new Date());
    if (expenseDate > todayStr) {
      return 'Expense date cannot be in the future';
    }

    // 3. Merchant
    if (receiptType !== 'none') {
      if (!merchant || !merchant.trim()) {
        return 'Merchant name is required';
      }
    }

    // 4. Category
    if (!category) {
      return 'Please select a category';
    }

    // 5. Reason
    const reasonClean = reason.trim();
    if (reasonClean.length < 3) {
      return 'Reason must be at least 3 characters';
    }
    if (receiptType === 'none' || category === 'other') {
      if (reasonClean.length < 10) {
        const reqReason = receiptType === 'none' ? 'when no bill is attached' : "for category 'Other'";
        return `Reason must be at least 10 characters ${reqReason}`;
      }
    }

    return null;
  };

  const handleSubmit = async (forceSubmitDuplicate: boolean = false) => {
    if (submitting) return; // Prevent double-tap submit

    const error = validateForm();
    if (error) {
      setErrorMessage(error);
      return;
    }
    setErrorMessage(null);

    setSubmitting(true);
    try {
      const payload: ExpensePayload = {
        amount_minor: parsedPaise,
        currency: 'INR',
        expense_date: expenseDate,
        merchant: merchant.trim() || null,
        category: category!,
        reason: reason.trim(),
        receipt_type: receiptType,
        extraction_status: confidence.amount !== undefined ? 'ok' : 'manual',
        attachment_ids: attachmentIds,
        edited_fields: Array.from(editedFields),
      };

      const result = await submitExpense(payload, idempotencyKey);

      // Check if duplicate flag returned from server
      if (result.possible_duplicate && !forceSubmitDuplicate && !duplicateWarning) {
        setDuplicateWarning(true);
        setSubmitting(false);
        return;
      }

      // Clear persisted draft on successful submit
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem('ope_active_draft');
        } catch {}
      }

      // Navigate to confirmation screen
      router.replace({
        pathname: '/confirmation',
        params: {
          referenceId: result.reference_id,
          amountPaise: String(result.amount_minor),
          merchant: result.merchant || 'Expense',
        },
      });
    } catch (err: any) {
      setErrorMessage(
        err.detail || err.message || 'Failed to submit expense. Please check your connection and tap Retry.'
      );
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            hitSlop={12}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Review Expense</Text>
            <Text style={styles.headerSub}>Verify details before submission</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
            {/* ── Error Banner ────────────────────────────── */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                  onPress={() => handleSubmit(duplicateWarning)}
                  style={({ pressed }) => [
                    styles.retryBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Retry submit"
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {/* ── Non-blocking Extraction Notices & Conflicts ── */}
            {(notices.length > 0 || conflicts.length > 0) && (
              <View style={styles.noticesCard}>
                {conflicts.map((c, i) => (
                  <View key={`conf-${i}`} style={styles.noticeRow}>
                    <Ionicons name="information-circle" size={16} color={theme.colors.indigo} />
                    <Text style={styles.noticeText}>{c}</Text>
                  </View>
                ))}
                {notices.map((n, i) => (
                  <View key={`not-${i}`} style={styles.noticeRow}>
                    <Ionicons name="bulb-outline" size={16} color={theme.colors.amber} />
                    <Text style={styles.noticeText}>{n}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Duplicate Notice Banner ─────────────────── */}
            {duplicateWarning && (
              <View style={styles.duplicateBanner}>
                <View style={styles.duplicateHeader}>
                  <Ionicons name="warning-outline" size={20} color={theme.colors.amber} />
                  <Text style={styles.duplicateTitle}>
                    Looks like you already submitted this
                  </Text>
                </View>
                <Text style={styles.duplicateSubtitle}>
                  A submission with the same merchant, amount, and date was found.
                </Text>
                <Pressable
                  onPress={() => handleSubmit(true)}
                  style={({ pressed }) => [
                    styles.submitAnywayBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.submitAnywayText}>Submit anyway</Text>
                </Pressable>
              </View>
            )}

            {/* ── Attached Files (Thumbnails & PDFs) ────── */}
            {attachmentIds.length > 0 && (
              <View style={styles.attachedSection}>
                <Text style={styles.fieldLabel}>ATTACHED FILES ({attachmentIds.length} of 3)</Text>
                <View style={styles.attachedFilesGrid}>
                  {attachmentIds.map((aid, idx) => {
                    const previewUrl = `${API_BASE_URL}/attachments/${aid}`;
                    return (
                      <View key={aid} style={styles.attachedItemWrap}>
                        <Image
                          source={{ uri: previewUrl }}
                          style={styles.attachedThumbnail}
                          resizeMode="cover"
                        />
                        <Pressable
                          onPress={() => {
                            setAttachmentIds((prev) => prev.filter((id) => id !== aid));
                          }}
                          style={styles.removeAttachedBtn}
                          hitSlop={8}
                          accessibilityLabel="Remove attachment"
                        >
                          <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── FIELD 1: Amount ──────────────────────────── */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>AMOUNT (₹) *</Text>
                {isLowConfAmount && (
                  <View style={styles.pleaseCheckPill}>
                    <Ionicons name="alert-circle-outline" size={12} color={theme.colors.amber} />
                    <Text style={styles.pleaseCheckText}>Please check</Text>
                  </View>
                )}
              </View>
              <View style={[styles.amountInputWrap, isLowConfAmount && styles.lowConfBorder]}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountStr}
                  onChangeText={(val) => {
                    const clean = val.replace(/[^0-9.]/g, '');
                    setAmountStr(clean);
                    setDuplicateWarning(false);
                    markEdited('amount');
                  }}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="decimal-pad"
                  autoFocus={!params.amount}
                />
              </View>
              {parsedPaise > 0 && (
                <Text style={styles.fieldHelper}>
                  {formatINR(parsedPaise)}
                </Text>
              )}
            </View>

            {/* ── FIELD 2: Date ────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>DATE (YYYY-MM-DD) *</Text>
                {isLowConfDate && (
                  <View style={styles.pleaseCheckPill}>
                    <Ionicons name="alert-circle-outline" size={12} color={theme.colors.amber} />
                    <Text style={styles.pleaseCheckText}>Please check</Text>
                  </View>
                )}
              </View>
              <View style={[styles.inputWrap, isLowConfDate && styles.lowConfBorder]}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={expenseDate}
                  onChangeText={(val) => {
                    setExpenseDate(val);
                    setDuplicateWarning(false);
                    markEdited('date');
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                  maxLength={10}
                />
                <Pressable
                  onPress={() => {
                    setExpenseDate(toYYYYMMDD(new Date()));
                    markEdited('date');
                  }}
                  style={styles.todayBtn}
                >
                  <Text style={styles.todayBtnText}>Today</Text>
                </Pressable>
              </View>
            </View>

            {/* ── FIELD 3: Merchant ────────────────────────── */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>
                  MERCHANT / PAYEE {receiptType !== 'none' ? '*' : '(OPTIONAL)'}
                </Text>
                {isLowConfMerchant && (
                  <View style={styles.pleaseCheckPill}>
                    <Ionicons name="alert-circle-outline" size={12} color={theme.colors.amber} />
                    <Text style={styles.pleaseCheckText}>Please check</Text>
                  </View>
                )}
              </View>
              <View style={[styles.inputWrap, isLowConfMerchant && styles.lowConfBorder]}>
                <Ionicons
                  name="storefront-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={merchant}
                  onChangeText={(val) => {
                    setMerchant(val);
                    setDuplicateWarning(false);
                    markEdited('merchant');
                  }}
                  placeholder="e.g. Uber, Blue Tokai, Taj Hotel"
                  placeholderTextColor={theme.colors.textSecondary}
                  maxLength={200}
                />
              </View>
            </View>

            {/* ── FIELD 4: Category Chips ──────────────────── */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>CATEGORY *</Text>
                {isLowConfCategory && (
                  <View style={styles.pleaseCheckPill}>
                    <Ionicons name="alert-circle-outline" size={12} color={theme.colors.amber} />
                    <Text style={styles.pleaseCheckText}>Please check</Text>
                  </View>
                )}
              </View>
              <View style={styles.chipGrid}>
                {CATEGORY_OPTIONS.map((item) => {
                  const isSelected = category === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        setCategory(item.key);
                        markEdited('category');
                      }}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={
                          isSelected ? theme.colors.white : theme.colors.textPrimary
                        }
                      />
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── FIELD 5: Reason ──────────────────────────── */}
            <View style={styles.fieldGroup}>
              <View style={styles.reasonHeaderRow}>
                <Text style={styles.fieldLabel}>REASON / BUSINESS PURPOSE *</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isLowConfReason && (
                    <View style={styles.pleaseCheckPill}>
                      <Ionicons name="alert-circle-outline" size={12} color={theme.colors.amber} />
                      <Text style={styles.pleaseCheckText}>Please check</Text>
                    </View>
                  )}
                  <Text style={styles.reasonMinHint}>
                    {receiptType === 'none' || category === 'other'
                      ? 'Min 10 chars'
                      : 'Min 3 chars'}
                  </Text>
                </View>
              </View>
              <TextInput
                style={[styles.reasonInput, isLowConfReason && styles.lowConfBorder]}
                value={reason}
                onChangeText={(val) => {
                  setReason(val);
                  markEdited('reason');
                }}
                placeholder="e.g. Client debrief meeting with Shekhar at BKC office"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
          </View>
        </ScrollView>

        {/* ── Sticky Bottom Submit Bar ────────────────────── */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={[styles.bottomBarInner, { maxWidth: containerMaxWidth }]}>
            <Pressable
              onPress={() => handleSubmit(false)}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.9 },
                submitting && { opacity: 0.7 },
              ]}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator size="small" color={theme.colors.white} />
                  <Text style={styles.submitBtnText}>Submitting…</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Submit Expense</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.bgPrimary,
  },
  backBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 110,
  },
  container: {
    width: '100%',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    flex: 1,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.white,
  },

  // Duplicate Warning Banner
  duplicateBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: 4,
  },
  duplicateTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    fontWeight: '700',
    color: theme.colors.textAmber,
  },
  duplicateSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  submitAnywayBtn: {
    backgroundColor: theme.colors.amber,
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  submitAnywayText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.white,
  },

  // Attached Files
  attachedSection: {
    marginBottom: theme.spacing.xl,
  },
  attachedFilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  attachedItemWrap: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgSecondary,
  },
  attachedThumbnail: {
    width: '100%',
    height: '100%',
  },
  removeAttachedBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: theme.colors.white,
    borderRadius: 10,
  },

  // Notices Card
  noticesCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  noticeText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    flex: 1,
  },

  // Field Header Row & Low Confidence Accents
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  pleaseCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    gap: 4,
  },
  pleaseCheckText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.amber,
  },
  lowConfBorder: {
    borderColor: theme.colors.amber,
    borderWidth: 1.5,
  },

  // Field Groups
  fieldGroup: {
    marginBottom: theme.spacing.xl,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
    marginBottom: theme.spacing.xs,
  },
  fieldHelper: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.indigo,
    fontWeight: '600',
    marginTop: 4,
  },

  // Amount
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgPrimary,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
  },
  currencySymbol: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingLarge,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingLarge,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.sm,
  },

  // Generic Input
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgPrimary,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.sm,
  },
  todayBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSecondary,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.indigo,
    fontWeight: '600',
  },

  // Category Chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgSecondary,
    minHeight: 48,
  },
  chipSelected: {
    backgroundColor: theme.colors.navy,
    borderColor: theme.colors.navy,
  },
  chipText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: theme.colors.white,
    fontWeight: '600',
  },

  // Reason
  reasonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasonMinHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgPrimary,
    padding: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  // Sticky Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  bottomBarInner: {
    width: '100%',
  },
  submitBtn: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...theme.shadows.md,
  },
  submitBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.white,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});
