import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import {
  API_BASE_URL,
  CategoryKey,
  ExpensePayload,
  submitExpense,
} from '../utils/api';
import { formatINR, parseAmountToPaise } from '../utils/format';
import {
  ExpenseFields,
  ExpenseFieldKey,
} from '../components/ExpenseFields';
import {
  AttachmentGrid,
  AttachmentTile,
} from '../components/AttachmentGrid';
import { LineItemsCard } from '../components/LineItemsCard';
import { clearExtraction, recallExtraction } from '../utils/draft_store';
import { summarizeExtraction } from '../utils/extraction';

interface DraftAttachment {
  id: string;
  mime: string;
  filename: string | null;
  kind?: string;
}

type AiStatus = 'ok' | 'partial' | 'failed' | 'manual';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `draft-${Math.random().toString(36).slice(2, 14)}-${Date.now()}`;
}

function toYYYYMMDD(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseConfidence(value?: string): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;

  const params = useLocalSearchParams<{
    receiptType?: 'bill_photo' | 'payment_screenshot' | 'none';
    amount?: string;
    merchant?: string;
    date?: string;
    category?: CategoryKey;
    reason?: string;
    attachmentIds?: string;
    attachments?: string;
    confidence?: string;
    notices?: string;
    conflicts?: string;
    aiStatus?: AiStatus;
  }>();

  const aiStatus = (params.aiStatus || 'manual') as AiStatus;
  const confidence = parseConfidence(params.confidence);
  const notices = parseJsonArray<string>(params.notices);
  const conflicts = parseJsonArray<string>(params.conflicts);
  const [extractionDraft] = useState(() => recallExtraction());
  const extractionSummary = summarizeExtraction(extractionDraft);

  const parsedAttachmentIds = parseJsonArray<string>(params.attachmentIds);
  const parsedAttachments = parseJsonArray<DraftAttachment>(params.attachments);

  const [attachments, setAttachments] = useState<DraftAttachment[]>(() => {
    if (parsedAttachments.length > 0) return parsedAttachments;
    return parsedAttachmentIds.map((id) => ({
      id,
      mime: 'image/jpeg',
      filename: `receipt_${id.slice(0, 6)}.jpg`,
      kind: 'bill',
    }));
  });

  const [attachmentIds, setAttachmentIds] = useState<string[]>(parsedAttachmentIds);
  const [receiptType, setReceiptType] = useState<
    'bill_photo' | 'payment_screenshot' | 'none'
  >(
    params.receiptType ||
      (parsedAttachmentIds.length > 0 ? 'bill_photo' : 'none')
  );

  const initialCategory =
    params.category && (aiStatus !== 'failed' || params.category !== 'other')
      ? params.category
      : null;

  const [amountStr, setAmountStr] = useState(params.amount || '');
  const [expenseDate, setExpenseDate] = useState(
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : toYYYYMMDD(new Date())
  );
  const [merchant, setMerchant] = useState(params.merchant || '');
  const [category, setCategory] = useState<CategoryKey | null>(initialCategory);
  const [reason, setReason] = useState(params.reason || '');
  const [editedFields, setEditedFields] = useState<Set<ExpenseFieldKey>>(
    () => new Set()
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [idempotencyKey] = useState(generateIdempotencyKey);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(
          'ope_active_draft',
          JSON.stringify({
            amountStr,
            expenseDate,
            merchant,
            category,
            reason,
            receiptType,
            attachmentIds,
          })
        );
      } catch {
        // Session storage can be unavailable in private browsing.
      }
    }
  }, [
    amountStr,
    expenseDate,
    merchant,
    category,
    reason,
    receiptType,
    attachmentIds,
  ]);

  const parsedAmount = parseAmountToPaise(amountStr);
  const parsedPaise = parsedAmount ?? 0;

  const markEdited = (field: ExpenseFieldKey) => {
    setEditedFields((previous) => {
      if (previous.has(field)) return previous;
      const next = new Set(previous);
      next.add(field);
      return next;
    });
    setDuplicateWarning(false);
    setErrorMessage(null);
  };

  const aiFilled: Partial<Record<ExpenseFieldKey, boolean>> = {
    amount: !editedFields.has('amount') && Number(confidence.amount) >= 0.6,
    date: !editedFields.has('date') && Number(confidence.date) >= 0.6,
    merchant:
      !editedFields.has('merchant') &&
      !!merchant &&
      Number(confidence.merchant) >= 0.6,
    category:
      !editedFields.has('category') &&
      !!category &&
      Number(confidence.category) >= 0.6,
    reason:
      !editedFields.has('reason') &&
      !!reason.trim() &&
      Number(confidence.reason) >= 0.6,
  };

  const needsCheck: Partial<Record<ExpenseFieldKey, boolean>> = {
    amount:
      !editedFields.has('amount') &&
      !!amountStr &&
      Number(confidence.amount) < 0.6,
    date:
      !editedFields.has('date') &&
      !!params.date &&
      Number(confidence.date) < 0.6,
    merchant:
      !editedFields.has('merchant') &&
      !!merchant &&
      Number(confidence.merchant) < 0.6,
    category:
      !editedFields.has('category') &&
      !!category &&
      Number(confidence.category) < 0.6,
    reason:
      !editedFields.has('reason') &&
      !!reason.trim() &&
      Number(confidence.reason) < 0.6,
  };

  const confidenceValues = ['amount', 'date', 'merchant', 'category']
    .map((key) => confidence[key])
    .filter((value): value is number => typeof value === 'number');
  const confidenceAverage =
    confidenceValues.length > 0
      ? Math.round(
          (confidenceValues.reduce((sum, value) => sum + value, 0) /
            confidenceValues.length) *
            100
        )
      : null;

  const validateForm = (): string | null => {
    if (parsedAmount === null || parsedAmount <= 0) {
      return 'Enter a valid amount greater than ₹0.';
    }
    if (parsedPaise > 100_000_000) {
      return 'Amount cannot exceed ₹10,00,000.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      return 'Enter the date as YYYY-MM-DD.';
    }
    if (expenseDate > toYYYYMMDD(new Date())) {
      return 'Expense date cannot be in the future.';
    }
    if (receiptType !== 'none' && !merchant.trim()) {
      return 'Merchant name is required when a receipt is attached.';
    }
    if (!category) {
      return 'Choose a category for this claim.';
    }

    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
      return 'Add a short business purpose (at least 3 characters).';
    }
    if (
      (receiptType === 'none' || category === 'other') &&
      cleanReason.length < 10
    ) {
      return receiptType === 'none'
        ? 'Describe the purpose in at least 10 characters when there is no receipt.'
        : "Describe the purpose in at least 10 characters for category 'Other'.";
    }
    return null;
  };

  const handleSubmit = async (forceDuplicate = false) => {
    if (submitting) return;

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const draft = recallExtraction();
      const payload: ExpensePayload = {
        amount_minor: parsedPaise,
        currency: 'INR',
        expense_date: expenseDate,
        merchant: merchant.trim() || null,
        category: category!,
        reason: reason.trim(),
        receipt_type: receiptType,
        extraction_status:
          aiStatus === 'ok'
            ? 'ok'
            : aiStatus === 'partial'
            ? 'partial'
            : 'manual',
        extraction_json: draft,
        extracted_amount_minor: draft?.fields?.amount_minor ?? null,
        extracted_date: draft?.fields?.expense_date ?? null,
        extracted_merchant: draft?.fields?.merchant ?? null,
        attachment_ids: attachmentIds,
        edited_fields: Array.from(editedFields),
      };

      const result = await submitExpense(payload, idempotencyKey);

      if (result.possible_duplicate && !forceDuplicate && !duplicateWarning) {
        setDuplicateWarning(true);
        setSubmitting(false);
        return;
      }

      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem('ope_active_draft');
        } catch {
          // Ignore.
        }
      }
      clearExtraction();

      router.replace({
        pathname: '/confirmation',
        params: {
          referenceId: result.reference_id,
          amountPaise: String(result.amount_minor),
          merchant: result.merchant || 'Expense',
        },
      });
    } catch (error: any) {
      setErrorMessage(
        error?.detail ||
          error?.message ||
          'Could not submit the expense. Check your connection and try again.'
      );
      setSubmitting(false);
    }
  };

  const openAttachment = (item: AttachmentTile) => {
    if (!item.uri) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(item.uri, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(item.uri).catch(() => {});
  };

  const removeAttachment = (key: string) => {
    setAttachments((previous) => previous.filter((item) => item.id !== key));
    setAttachmentIds((previous) => previous.filter((id) => id !== key));
  };

  const attachmentTiles: AttachmentTile[] = attachments.map((item) => ({
    key: item.id,
    uri: `${API_BASE_URL}/attachments/${item.id}`,
    name: item.filename || 'receipt',
    mime: item.mime,
    isPdf: item.mime === 'application/pdf',
  }));

  const aiSucceeded = aiStatus === 'ok' || aiStatus === 'partial';

  const logAnother = () => {
    router.replace('/snap');
  };

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.desktopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopEyebrow}>
                {receiptType === 'payment_screenshot'
                  ? 'REVIEW • PAYMENT PROOF'
                  : receiptType === 'bill_photo'
                  ? 'REVIEW • BILL CAPTURE'
                  : 'REVIEW • MANUAL ENTRY'}
              </Text>
              <Text style={styles.desktopTitle}>Verify the details</Text>
              <Text style={styles.desktopSubtitle}>
                AI filled what it could. Check every field before it goes to the
                ledger.
              </Text>
            </View>
            <View style={styles.desktopHeaderRight}>
              {confidenceAverage !== null ? (
                <View style={styles.desktopConfidencePill}>
                  <Ionicons
                    name="sparkles"
                    size={12}
                    color={theme.colors.amberDeep}
                  />
                  <Text style={styles.desktopConfidenceText}>
                    {confidenceAverage}% CONFIDENCE
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => router.back()}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.desktopGhostButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name="arrow-back"
                  size={15}
                  color={theme.colors.textPrimary}
                />
                <Text style={styles.desktopGhostButtonText}>Back</Text>
              </Pressable>
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={17}
                color={theme.colors.error}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable
                onPress={() => setErrorMessage(null)}
                hitSlop={8}
                accessibilityLabel="Dismiss error"
              >
                <Ionicons name="close" size={16} color={theme.colors.error} />
              </Pressable>
            </View>
          ) : null}

          {notices.length > 0 || conflicts.length > 0 ? (
            <View style={[styles.noticeCard, { marginBottom: 18 }]}>
              {conflicts.map((notice, index) => (
                <View key={`conflict-${index}`} style={styles.noticeRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={15}
                    color={theme.colors.amberDeep}
                  />
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              ))}
              {notices.map((notice, index) => (
                <View key={`notice-${index}`} style={styles.noticeRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {duplicateWarning ? (
            <View style={[styles.duplicateCard, { marginBottom: 18 }]}>
              <View style={styles.duplicateHeader}>
                <View style={styles.duplicateIcon}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={theme.colors.amberDeep}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.duplicateTitle}>This looks familiar</Text>
                  <Text style={styles.duplicateSubtitle}>
                    A claim with the same merchant, amount, and date already
                    exists.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleSubmit(true)}
                style={({ pressed }) => [
                  styles.duplicateButton,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text style={styles.duplicateButtonText}>Submit anyway</Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={theme.colors.amberDeep}
                />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.desktopGrid}>
            <View style={styles.desktopFormCol}>
              <View style={[styles.formCard, styles.desktopFormCard]}>
                <ExpenseFields
                  amountStr={amountStr}
                  onAmountChange={(value) => {
                    setAmountStr(value);
                    markEdited('amount');
                  }}
                  expenseDate={expenseDate}
                  onDateChange={(value) => {
                    setExpenseDate(value);
                    markEdited('date');
                  }}
                  onToday={() => {
                    setExpenseDate(toYYYYMMDD(new Date()));
                    markEdited('date');
                  }}
                  merchant={merchant}
                  onMerchantChange={(value) => {
                    setMerchant(value);
                    markEdited('merchant');
                  }}
                  category={category}
                  onCategoryChange={(value) => {
                    setCategory(value);
                    markEdited('category');
                  }}
                  reason={reason}
                  onReasonChange={(value) => {
                    setReason(value);
                    markEdited('reason');
                  }}
                  receiptType={receiptType}
                  aiFilled={aiFilled}
                  needsCheck={needsCheck}
                  disabled={submitting}
                  autoFocusAmount={!params.amount}
                />
              </View>

              <View style={styles.desktopFooter}>
                <View style={styles.footerBrandRow}>
                  <Text style={styles.footerBrand}>
                    Dexter OPE Instant Ledger
                  </Text>
                  <View style={styles.footerDot} />
                </View>
                <Text style={styles.footerSecurity}>
                  Encrypted in transit • Synced with Finance
                </Text>
              </View>
            </View>

            <View style={styles.desktopRail}>
              {aiSucceeded ? (
                <View style={styles.aiCard}>
                  <View style={styles.aiCardIcon}>
                    <Ionicons
                      name="sparkles"
                      size={19}
                      color={theme.colors.amberDeep}
                    />
                  </View>
                  <View style={styles.aiCardBody}>
                    <View style={styles.aiCardTitleRow}>
                      <Text style={styles.aiCardTitle}>
                        {aiStatus === 'ok'
                          ? 'AI extraction complete'
                          : 'AI filled most fields'}
                      </Text>
                      {confidenceAverage !== null ? (
                        <View style={styles.confidencePill}>
                          <Text style={styles.confidenceText}>
                            {confidenceAverage}% CONFIDENCE
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.aiCardSubtitle}>
                      {Object.values(needsCheck).some(Boolean)
                        ? 'Amber fields need a quick check.'
                        : receiptType === 'payment_screenshot'
                        ? 'Amount, payee, and date were read from your payment proof.'
                        : 'Amount, date, and merchant were read from your bill.'}
                    </Text>
                  </View>
                </View>
              ) : aiStatus === 'failed' ? (
                <View style={[styles.aiCard, styles.aiCardWarning]}>
                  <View style={[styles.aiCardIcon, styles.aiCardIconWarning]}>
                    <Ionicons
                      name="create-outline"
                      size={19}
                      color={theme.colors.amberDeep}
                    />
                  </View>
                  <View style={styles.aiCardBody}>
                    <Text style={styles.aiCardTitle}>
                      AI couldn't read this bill
                    </Text>
                    <Text style={styles.aiCardSubtitle}>
                      Your file is attached. Add the missing details manually.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.manualChipRow}>
                  <View style={styles.manualChip}>
                    <Ionicons
                      name="create-outline"
                      size={12}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.manualChipText}>MANUAL ENTRY</Text>
                  </View>
                  {attachmentIds.length > 0 ? (
                    <Text style={styles.manualChipHint}>
                      {attachmentIds.length}{' '}
                      {attachmentIds.length === 1 ? 'file' : 'files'} attached
                    </Text>
                  ) : null}
                </View>
              )}

              {extractionSummary.lineItems.length > 0 ? (
                <LineItemsCard
                  items={extractionSummary.lineItems}
                  claimedAmountMinor={parsedPaise}
                />
              ) : null}

              {attachmentTiles.length > 0 ? (
                <View style={styles.desktopRailCard}>
                  <View style={styles.attachmentsHeader}>
                    <Text style={styles.sectionLabel}>
                      {receiptType === 'payment_screenshot'
                        ? 'ATTACHED PROOF'
                        : 'ATTACHED RECEIPT'}
                    </Text>
                    <View style={styles.receiptTypePill}>
                      <Ionicons
                        name={
                          receiptType === 'payment_screenshot'
                            ? 'phone-portrait-outline'
                            : 'receipt-outline'
                        }
                        size={11}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.receiptTypeText}>
                        {receiptType === 'payment_screenshot'
                          ? 'PAYMENT PROOF'
                          : 'BILL PHOTO'}
                      </Text>
                    </View>
                  </View>
                  <AttachmentGrid
                    items={attachmentTiles}
                    onRemove={removeAttachment}
                    onOpen={openAttachment}
                  />
                </View>
              ) : null}

              <View style={styles.desktopSubmitCard}>
                <View style={styles.desktopSubmitTop}>
                  <View>
                    <Text style={styles.desktopSubmitLabel}>
                      READY TO FILE
                    </Text>
                    <Text style={styles.desktopSubmitAmount}>
                      {parsedPaise > 0 ? formatINR(parsedPaise) : '₹0.00'}
                    </Text>
                  </View>
                  <View style={styles.desktopSubmitMeta}>
                    <Ionicons
                      name={
                        receiptType === 'none'
                          ? 'document-outline'
                          : receiptType === 'payment_screenshot'
                          ? 'phone-portrait-outline'
                          : 'receipt-outline'
                      }
                      size={14}
                      color="rgba(255,255,255,0.55)"
                    />
                    <Text style={styles.desktopSubmitMetaText}>
                      {receiptType === 'none'
                        ? 'No receipt'
                        : receiptType === 'payment_screenshot'
                        ? 'Payment proof attached'
                        : 'Receipt attached'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => handleSubmit(false)}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.desktopSubmitButton,
                    pressed && { opacity: 0.9 },
                    submitting && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Submit expense"
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.ink}
                      />
                      <Text style={styles.desktopSubmitButtonText}>
                        Submitting…
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.desktopSubmitButtonText}>
                        Submit expense
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={17}
                        color={theme.colors.ink}
                      />
                    </>
                  )}
                </Pressable>

                <Text style={styles.desktopSubmitNote}>
                  {aiStatus === 'manual'
                    ? 'Manual entry • Review all fields before filing'
                    : 'AI draft • You can still edit every field'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { opacity: 0.55 },
            ]}
            hitSlop={10}
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.wordmark}>DEXTER CAPITAL</Text>
            <Text style={styles.headerTitle}>Review Expense</Text>
          </View>

          <View style={styles.headerBadge}>
            <Ionicons
              name="shield-checkmark-outline"
              size={19}
              color={theme.colors.textSecondary}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 128 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>LEDGER ENTRY</Text>
          <Text style={styles.pageTitle}>Verify the details</Text>
          <Text style={styles.pageSubtitle}>
            AI filled what it could. Check every field before it goes to the
            ledger.
          </Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={17}
                color={theme.colors.error}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable
                onPress={() => setErrorMessage(null)}
                hitSlop={8}
                accessibilityLabel="Dismiss error"
              >
                <Ionicons name="close" size={16} color={theme.colors.error} />
              </Pressable>
            </View>
          ) : null}

          {/* AI summary */}
          {aiSucceeded ? (
            <View style={styles.aiCard}>
              <View style={styles.aiCardIcon}>
                <Ionicons
                  name="sparkles"
                  size={19}
                  color={theme.colors.amberDeep}
                />
              </View>
              <View style={styles.aiCardBody}>
                <View style={styles.aiCardTitleRow}>
                  <Text style={styles.aiCardTitle}>
                    {aiStatus === 'ok'
                      ? 'AI extraction complete'
                      : 'AI filled most fields'}
                  </Text>
                  {confidenceAverage !== null ? (
                    <View style={styles.confidencePill}>
                      <Text style={styles.confidenceText}>
                        {confidenceAverage}% CONFIDENCE
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.aiCardSubtitle}>
                  {Object.values(needsCheck).some(Boolean)
                    ? 'Amber fields need a quick check.'
                    : receiptType === 'payment_screenshot'
                    ? 'Amount, payee, and date were read from your payment proof.'
                    : 'Amount, date, and merchant were read from your bill.'}
                </Text>
              </View>
            </View>
          ) : aiStatus === 'failed' ? (
            <View style={[styles.aiCard, styles.aiCardWarning]}>
              <View style={[styles.aiCardIcon, styles.aiCardIconWarning]}>
                <Ionicons
                  name="create-outline"
                  size={19}
                  color={theme.colors.amberDeep}
                />
              </View>
              <View style={styles.aiCardBody}>
                <Text style={styles.aiCardTitle}>AI couldn't read this bill</Text>
                <Text style={styles.aiCardSubtitle}>
                  Your file is attached. Add the missing details manually — it
                  only takes a moment.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.manualChipRow}>
              <View style={styles.manualChip}>
                <Ionicons
                  name="create-outline"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.manualChipText}>MANUAL ENTRY</Text>
              </View>
              {attachmentIds.length > 0 ? (
                <Text style={styles.manualChipHint}>
                  {attachmentIds.length}{' '}
                  {attachmentIds.length === 1 ? 'file' : 'files'} attached
                </Text>
              ) : null}
            </View>
          )}

          {notices.length > 0 || conflicts.length > 0 ? (
            <View style={styles.noticeCard}>
              {conflicts.map((notice, index) => (
                <View key={`conflict-${index}`} style={styles.noticeRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={15}
                    color={theme.colors.amberDeep}
                  />
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              ))}
              {notices.map((notice, index) => (
                <View key={`notice-${index}`} style={styles.noticeRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {extractionSummary.lineItems.length > 0 ? (
            <LineItemsCard
              items={extractionSummary.lineItems}
              claimedAmountMinor={parsedPaise}
            />
          ) : null}

          {duplicateWarning ? (
            <View style={styles.duplicateCard}>
              <View style={styles.duplicateHeader}>
                <View style={styles.duplicateIcon}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={theme.colors.amberDeep}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.duplicateTitle}>
                    This looks familiar
                  </Text>
                  <Text style={styles.duplicateSubtitle}>
                    A claim with the same merchant, amount, and date already
                    exists.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleSubmit(true)}
                style={({ pressed }) => [
                  styles.duplicateButton,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text style={styles.duplicateButtonText}>Submit anyway</Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={theme.colors.amberDeep}
                />
              </Pressable>
            </View>
          ) : null}

          {attachmentTiles.length > 0 ? (
            <View style={styles.attachmentsSection}>
              <View style={styles.attachmentsHeader}>
                <Text style={styles.sectionLabel}>
                  {receiptType === 'payment_screenshot'
                    ? 'ATTACHED PROOF'
                    : 'ATTACHED RECEIPT'}
                </Text>
                <View style={styles.receiptTypePill}>
                  <Ionicons
                    name={
                      receiptType === 'payment_screenshot'
                        ? 'phone-portrait-outline'
                        : 'receipt-outline'
                    }
                    size={11}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.receiptTypeText}>
                    {receiptType === 'payment_screenshot'
                      ? 'PAYMENT PROOF'
                      : 'BILL PHOTO'}
                  </Text>
                </View>
              </View>
              <AttachmentGrid
                items={attachmentTiles}
                onRemove={removeAttachment}
                onOpen={openAttachment}
              />
            </View>
          ) : null}

          <View style={styles.formCard}>
            <ExpenseFields
              amountStr={amountStr}
              onAmountChange={(value) => {
                setAmountStr(value);
                markEdited('amount');
              }}
              expenseDate={expenseDate}
              onDateChange={(value) => {
                setExpenseDate(value);
                markEdited('date');
              }}
              onToday={() => {
                setExpenseDate(toYYYYMMDD(new Date()));
                markEdited('date');
              }}
              merchant={merchant}
              onMerchantChange={(value) => {
                setMerchant(value);
                markEdited('merchant');
              }}
              category={category}
              onCategoryChange={(value) => {
                setCategory(value);
                markEdited('category');
              }}
              reason={reason}
              onReasonChange={(value) => {
                setReason(value);
                markEdited('reason');
              }}
              receiptType={receiptType}
              aiFilled={aiFilled}
              needsCheck={needsCheck}
              disabled={submitting}
              autoFocusAmount={!params.amount}
            />
          </View>

          <View style={styles.footer}>
            <View style={styles.footerBrandRow}>
              <Text style={styles.footerBrand}>Dexter OPE Instant Ledger</Text>
              <View style={styles.footerDot} />
            </View>
            <View style={styles.footerSecurityRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color={theme.colors.textMuted}
              />
              <Text style={styles.footerSecurity}>
                Encrypted in transit • Synced with Finance
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky submit bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={() => handleSubmit(false)}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && { opacity: 0.92 },
              submitting && { opacity: 0.72 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Submit expense"
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color={theme.colors.white} />
                <Text style={styles.submitButtonText}>Submitting…</Text>
              </>
            ) : (
              <>
                <View style={styles.submitLeft}>
                  <Text style={styles.submitButtonText}>Submit expense</Text>
                  <Text style={styles.submitHint}>
                    {receiptType === 'none'
                      ? 'No receipt'
                      : receiptType === 'payment_screenshot'
                      ? 'Payment proof attached'
                      : 'Receipt attached'}
                  </Text>
                </View>
                <View style={styles.submitAmountPill}>
                  <Text style={styles.submitAmountText}>
                    {parsedPaise > 0 ? formatINR(parsedPaise) : '₹0.00'}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={theme.colors.amberOnDark}
                  />
                </View>
              </>
            )}
          </Pressable>

          {aiStatus === 'failed' ? (
            <Pressable
              onPress={logAnother}
              disabled={submitting}
              style={({ pressed }) => [
                styles.captureAgainLink,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons
                name="camera-outline"
                size={13}
                color={theme.colors.textMuted}
              />
              <Text style={styles.captureAgainText}>Capture a clearer photo</Text>
            </Pressable>
          ) : null}
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
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: theme.colors.textMuted,
    marginBottom: 3,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.sm,
  },
  eyebrow: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.amber,
    marginBottom: 7,
  },
  pageTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.textPrimary,
  },
  pageSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: 5,
    marginBottom: theme.spacing.xl,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    backgroundColor: theme.colors.errorSoft,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: theme.colors.error,
  },

  aiCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    marginBottom: 12,
  },
  aiCardWarning: {
    backgroundColor: theme.colors.amberSoft,
    borderColor: theme.colors.amberBorder,
  },
  aiCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(111,125,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  aiCardIconWarning: {
    backgroundColor: 'rgba(184,131,56,0.11)',
  },
  aiCardBody: {
    flex: 1,
  },
  aiCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  aiCardTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  aiCardSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  confidencePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  confidenceText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.55,
    color: theme.colors.success,
  },

  manualChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  manualChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  manualChipText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.colors.textSecondary,
  },
  manualChipHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: theme.colors.textMuted,
  },

  noticeCard: {
    gap: 8,
    padding: 13,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    backgroundColor: theme.colors.amberSoft,
    marginBottom: 12,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textPrimary,
  },

  duplicateCard: {
    padding: 14,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    backgroundColor: theme.colors.amberSoft,
    marginBottom: 14,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 11,
  },
  duplicateIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(184,131,56,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  duplicateSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  duplicateButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  duplicateButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.amberDeep,
  },

  attachmentsSection: {
    marginBottom: theme.spacing.xl,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  receiptTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  receiptTypeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.colors.textSecondary,
  },

  formCard: {
    paddingTop: 4,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 18,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  footerBrand: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.amber,
  },
  footerSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerSecurity: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: 10,
    backgroundColor: 'rgba(247,248,251,0.97)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  submitButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.ink,
    ...theme.shadows.lg,
  },
  submitLeft: {
    flex: 1,
  },
  submitButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  submitHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.52)',
    marginTop: 2,
  },
  submitAmountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(232,201,142,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(232,201,142,0.12)',
  },
  submitAmountText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: theme.colors.amberOnDark,
  },
  captureAgainLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 34,
  },
  captureAgainText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },

  // Desktop web
  desktopPage: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopScroll: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 36,
    paddingTop: 30,
    paddingBottom: 52,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 24,
  },
  desktopEyebrow: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: theme.colors.amber,
    marginBottom: 8,
  },
  desktopTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: theme.colors.textPrimary,
  },
  desktopSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  desktopHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  desktopConfidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  desktopConfidenceText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.colors.amberDeep,
  },
  desktopGhostButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  desktopGhostButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 22,
  },
  desktopFormCol: {
    flex: 1,
    minWidth: 0,
  },
  desktopFormCard: {
    padding: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  desktopRail: {
    width: 344,
    flexShrink: 0,
  },
  desktopRailCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 14,
  },
  desktopSubmitCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: theme.colors.ink,
    ...theme.shadows.md,
  },
  desktopSubmitTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  desktopSubmitLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.amberOnDark,
    marginBottom: 5,
  },
  desktopSubmitAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.white,
  },
  desktopSubmitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 4,
  },
  desktopSubmitMetaText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.55)',
  },
  desktopSubmitButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.amberOnDark,
  },
  desktopSubmitButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  desktopSubmitNote: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 13,
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    marginTop: 10,
  },
  desktopFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingHorizontal: 4,
  },
});
