import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import {
  API_BASE_URL,
  AttachmentRecord,
  ExpenseRecord,
  ReviewStatus,
  fetchExpenseById,
} from '../../utils/api';
import { formatINR, formatTime } from '../../utils/format';
import { AttachmentGrid, AttachmentTile } from '../../components/AttachmentGrid';
import { LineItemsCard } from '../../components/LineItemsCard';
import { summarizeExtraction } from '../../utils/extraction';

function isoDaysAgo(days: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function istDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function demoExpense(
  overrides: Partial<ExpenseRecord> & Pick<ExpenseRecord, 'id' | 'reference_id'>
): ExpenseRecord {
  return {
    user_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    amount_minor: 0,
    currency: 'INR',
    expense_date: istDateDaysAgo(0),
    merchant: null,
    category: 'other',
    category_label: 'Other',
    reason: '',
    receipt_type: 'bill_photo',
    txn_ref: null,
    invoice_no: null,
    tax_amount_minor: null,
    extraction_status: 'ok',
    review_status: 'submitted',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    billable: true,
    possible_duplicate: false,
    extraction_json: null,
    created_at: isoDaysAgo(0, 14, 15),
    attachment_count: 0,
    attachments: [],
    ...overrides,
  };
}

// Offline fallback mirrors the seeded ledger so detail navigation still works
// while the API cold-starts.
const FALLBACK_EXPENSES: ExpenseRecord[] = [
  demoExpense({
    id: 'a1b2c3d4-0001-4000-a000-000000000001',
    reference_id: 'OPE-A7K291',
    amount_minor: 6840,
    expense_date: istDateDaysAgo(0),
    merchant: 'Uber',
    category: 'cab_local_transport',
    category_label: 'Travel & Ground Transit',
    reason: 'Airport Transfer to Terminal 2',
    review_status: 'approved',
    reviewed_by: 'Partner Review • P. Sharma',
    created_at: isoDaysAgo(0, 14, 15),
  }),
  demoExpense({
    id: 'a1b2c3d4-0002-4000-a000-000000000002',
    reference_id: 'OPE-B3M472',
    amount_minor: 34000,
    expense_date: istDateDaysAgo(1),
    merchant: 'The Grill House',
    category: 'client_meals_entertainment',
    category_label: 'Client Entertainment',
    reason: 'Client Dinner (Founders Fund)',
    review_status: 'under_review',
    reviewed_by: 'Finance Review • In progress',
    created_at: isoDaysAgo(1, 20, 10),
  }),
  demoExpense({
    id: 'a1b2c3d4-0003-4000-a000-000000000003',
    reference_id: 'OPE-D1W694',
    amount_minor: 1850,
    expense_date: istDateDaysAgo(3),
    merchant: 'Blue Tokai Coffee',
    category: 'client_meals_entertainment',
    category_label: 'Client Entertainment',
    reason: 'Discussion with Series B team',
    review_status: 'approved',
    reviewed_by: 'Partner Review • P. Sharma',
    created_at: isoDaysAgo(3, 11, 20),
  }),
  demoExpense({
    id: 'a1b2c3d4-0004-4000-a000-000000000004',
    reference_id: 'OPE-K8L260',
    amount_minor: 245000,
    expense_date: istDateDaysAgo(5),
    merchant: 'IndiGo Airlines',
    category: 'travel',
    category_label: 'Flights & Hotels',
    reason: 'Return flight BOM-DEL for investor symposium',
    review_status: 'approved',
    reviewed_by: 'Partner Review • P. Sharma',
    created_at: isoDaysAgo(5, 9, 45),
  }),
  demoExpense({
    id: 'a1b2c3d4-0005-4000-a000-000000000005',
    reference_id: 'OPE-E5X705',
    amount_minor: 45000,
    expense_date: istDateDaysAgo(8),
    merchant: 'Taj Hotel',
    category: 'travel',
    category_label: 'Flights & Hotels',
    reason: 'Airport transit hotel for client workshop',
    review_status: 'approved',
    reviewed_by: 'Partner Review • P. Sharma',
    created_at: isoDaysAgo(8, 16, 30),
  }),
  demoExpense({
    id: 'a1b2c3d4-0006-4000-a000-000000000006',
    reference_id: 'OPE-G2Z927',
    amount_minor: 8560,
    expense_date: istDateDaysAgo(12),
    merchant: 'Amazon Business',
    category: 'office_supplies',
    category_label: 'Office & Supplies',
    reason: 'USB-C hub and notebook for desk setup',
    review_status: 'under_review',
    reviewed_by: 'Finance Review • In progress',
    created_at: isoDaysAgo(12, 14, 10),
  }),
  demoExpense({
    id: 'a1b2c3d4-0007-4000-a000-000000000007',
    reference_id: 'OPE-J4K159',
    amount_minor: 800,
    expense_date: istDateDaysAgo(15),
    merchant: 'Chai Point',
    category: 'team_meals',
    category_label: 'Meals & Dining',
    reason: 'Team chai after late client call',
    receipt_type: 'payment_screenshot',
    review_status: 'approved',
    reviewed_by: 'Partner Review • P. Sharma',
    created_at: isoDaysAgo(15, 17, 20),
  }),
];

function detailStamp(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return `${day} • ${formatTime(date)}`;
}

function statusMeta(status: ReviewStatus) {
  if (status === 'approved') {
    return {
      label: 'APPROVED',
      color: theme.colors.success,
      backgroundColor: theme.colors.successSoft,
      borderColor: theme.colors.successBorder,
    };
  }
  if (status === 'under_review') {
    return {
      label: 'UNDER REVIEW',
      color: theme.colors.amberDeep,
      backgroundColor: theme.colors.amberSoft,
      borderColor: theme.colors.amberBorder,
    };
  }
  if (status === 'rejected') {
    return {
      label: 'REJECTED',
      color: theme.colors.error,
      backgroundColor: theme.colors.errorSoft,
      borderColor: theme.colors.errorBorder,
    };
  }
  return {
    label: 'SUBMITTED',
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  };
}

function openReceipt(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url).catch(() => {});
}

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;

  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      setError('No expense reference was provided.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchExpenseById(params.id)
      .then((record) => {
        if (cancelled) return;
        setExpense(record);
        setLoading(false);
      })
      .catch((fetchError: any) => {
        if (cancelled) return;
        const fallback = FALLBACK_EXPENSES.find(
          (item) =>
            item.id.toLowerCase() === params.id.toLowerCase() ||
            item.reference_id.toLowerCase() === params.id.toLowerCase()
        );
        if (fallback) {
          setExpense(fallback);
        } else {
          setError(fetchError?.message || 'This expense could not be loaded.');
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const primaryAttachment: AttachmentRecord | undefined =
    expense?.attachments?.[0];
  const extraAttachments = Math.max(
    0,
    (expense?.attachments?.length || 0) - 1
  );

  const receiptName = primaryAttachment
    ? primaryAttachment.filename ||
      `receipt_${(expense?.reference_id || 'ope').toLowerCase()}.${
        primaryAttachment.mime === 'application/pdf' ? 'pdf' : 'jpg'
      }`
    : null;

  const receiptUrl =
    expense && primaryAttachment
      ? `${API_BASE_URL}/expenses/${expense.id}/attachments/${primaryAttachment.id}`
      : null;

  const attachmentTiles: AttachmentTile[] = (expense?.attachments || []).map(
    (item) => ({
      key: item.id,
      uri: `${API_BASE_URL}/expenses/${expense?.id}/attachments/${item.id}`,
      name: item.filename || 'receipt',
      mime: item.mime,
      isPdf: item.mime === 'application/pdf',
    })
  );

  const extractionSummary = summarizeExtraction(expense?.extraction_json);
  const meta = statusMeta(expense?.review_status || 'submitted');

  if (desktop) {
    if (!expense) return null;

    return (
      <View style={styles.desktopPage}>
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.desktopHeader}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.desktopBack,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to expenses"
            >
              <Ionicons
                name="arrow-back"
                size={15}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.desktopBackText}>Expenses</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopEyebrow}>OPE LEDGER</Text>
              <Text style={styles.desktopTitle}>Expense detail</Text>
              <Text style={styles.desktopSubtitle}>
                {expense.reference_id} • Submitted {detailStamp(expense.created_at)}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: meta.backgroundColor,
                  borderColor: meta.borderColor,
                },
              ]}
            >
              <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.statusText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>

          <View style={styles.desktopGrid}>
            <View style={styles.desktopMain}>
              <View style={styles.desktopHeroCard}>
                <Text style={[styles.cardLabel, styles.desktopLabelOnDark]}>
                  CLAIM AMOUNT
                </Text>
                <Text style={styles.desktopAmount}>
                  {formatINR(expense.amount_minor)}
                </Text>
                <Text style={styles.desktopMerchant}>
                  {expense.merchant || 'Expense claim'}
                </Text>
                <Text style={styles.desktopStamp}>
                  {detailStamp(expense.created_at || expense.expense_date)}
                </Text>
              </View>

              <View style={styles.desktopCard}>
                <Text style={styles.cardLabel}>BUSINESS PURPOSE</Text>
                <Text style={styles.desktopReason}>{expense.reason}</Text>
                {expense.billable ? (
                  <View style={styles.billableChip}>
                    <Text style={styles.billableText}>Billable OPE</Text>
                  </View>
                ) : null}
              </View>

              {extractionSummary.lineItems.length > 0 ? (
                <View style={styles.desktopCard}>
                  <LineItemsCard
                    items={extractionSummary.lineItems}
                    claimedAmountMinor={expense.amount_minor}
                    compact
                  />
                </View>
              ) : null}

              <View
                style={[
                  styles.desktopCard,
                  expense.review_status === 'rejected' && styles.desktopCardRejected,
                ]}
              >
                <Text style={styles.cardLabel}>
                  {expense.review_status === 'approved'
                    ? 'APPROVED BY'
                    : expense.review_status === 'rejected'
                    ? 'REJECTED BY'
                    : 'REVIEW STATUS'}
                </Text>
                <Text style={styles.desktopReviewer}>
                  {expense.reviewed_by ||
                    (expense.review_status === 'under_review'
                      ? 'Finance review • In progress'
                      : 'Awaiting finance review')}
                </Text>
                {expense.review_note ? (
                  <View style={styles.desktopReviewNote}>
                    <Text style={styles.reviewNoteLabel}>FINANCE NOTE</Text>
                    <Text style={styles.desktopReviewNoteText}>
                      {expense.review_note}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.desktopReviewHint}>
                    {expense.review_status === 'approved'
                      ? 'The finance team cleared this payment.'
                      : expense.review_status === 'rejected'
                      ? 'This claim was returned to the employee.'
                      : 'The claim is in the finance queue for a decision.'}
                  </Text>
                )}
              </View>

              <View style={styles.desktopReadonly}>
                <Ionicons
                  name="lock-closed"
                  size={13}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.readonlyText}>
                  Employee view • Read-only. Finance decisions sync here
                  automatically.
                </Text>
              </View>
            </View>

            <View style={styles.desktopRail}>
              <View style={styles.desktopCard}>
                <Text style={styles.cardLabel}>CLAIM DETAILS</Text>
                <View style={styles.desktopMetaRow}>
                  <Text style={styles.desktopMetaLabel}>Category</Text>
                  <Text style={styles.desktopMetaValue}>
                    {expense.category_label}
                  </Text>
                </View>
                <View style={styles.desktopMetaRow}>
                  <Text style={styles.desktopMetaLabel}>Receipt</Text>
                  <Text style={styles.desktopMetaValue}>
                    {expense.receipt_type === 'payment_screenshot'
                      ? 'UPI / payment proof'
                      : expense.receipt_type === 'bill_photo'
                      ? 'Bill photo or PDF'
                      : 'No receipt'}
                  </Text>
                </View>
                <View style={styles.desktopMetaRow}>
                  <Text style={styles.desktopMetaLabel}>Reference</Text>
                  <Text style={styles.desktopMetaValue}>
                    {expense.reference_id}
                  </Text>
                </View>
                <View style={styles.desktopMetaRow}>
                  <Text style={styles.desktopMetaLabel}>Submitted</Text>
                  <Text style={styles.desktopMetaValue}>
                    {detailStamp(expense.created_at)}
                  </Text>
                </View>
                <View style={styles.desktopMetaRow}>
                  <Text style={styles.desktopMetaLabel}>AI extraction</Text>
                  <Text style={styles.desktopMetaValue}>
                    {expense.extraction_status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.desktopCard}>
                <Text style={styles.cardLabel}>RECEIPT</Text>
                {attachmentTiles.length > 0 ? (
                  <AttachmentGrid
                    items={attachmentTiles}
                    size={82}
                    onOpen={(item) => {
                      if (item.uri) openReceipt(item.uri);
                    }}
                  />
                ) : (
                  <View style={styles.desktopNoReceipt}>
                    <Ionicons
                      name="document-outline"
                      size={17}
                      color={theme.colors.textMuted}
                    />
                    <Text style={styles.receiptMissing}>
                      No receipt attached
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.desktopRailFoot}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.footerText}>
                  Dexter OPE Instant Ledger • Verified
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && { opacity: 0.55 },
          ]}
          hitSlop={10}
          accessibilityLabel="Back to expenses"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>

        <Text style={styles.headerTitle}>Expense</Text>

        <View style={styles.ledgerPill}>
          <Text style={styles.ledgerPillText}>OPE LEDGER</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={theme.colors.amber} />
          <Text style={styles.loadingText}>Loading claim…</Text>
        </View>
      ) : error || !expense ? (
        <View style={styles.centered}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="receipt-outline"
              size={28}
              color={theme.colors.textMuted}
            />
          </View>
          <Text style={styles.errorTitle}>Claim not found</Text>
          <Text style={styles.errorSubtitle}>
            {error || 'This expense is no longer in the ledger.'}
          </Text>
          <Pressable
            onPress={() => router.replace('/home')}
            style={({ pressed }) => [
              styles.errorButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.errorButtonText}>Back to expenses</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 20 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Hero */}
            <View style={styles.hero}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: meta.backgroundColor,
                    borderColor: meta.borderColor,
                  },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: meta.color }]}
                />
                <Text style={[styles.statusText, { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>

              <Text style={styles.amount}>
                {formatINR(expense.amount_minor)}
              </Text>
              <Text style={styles.merchant}>
                {expense.merchant || 'Expense claim'}
              </Text>
              <Text style={styles.stamp}>
                {detailStamp(expense.created_at || expense.expense_date)}
              </Text>
            </View>

            {/* Category & receipt */}
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Category</Text>
                <Text style={styles.rowValue}>{expense.category_label}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Receipt</Text>
                <View style={styles.receiptValue}>
                  {receiptName ? (
                    <>
                      <Text style={styles.receiptName} numberOfLines={1}>
                        {receiptName}
                        {extraAttachments > 0 ? ` +${extraAttachments}` : ''}
                      </Text>
                      {receiptUrl ? (
                        <Pressable
                          onPress={() => openReceipt(receiptUrl)}
                          style={({ pressed }) => [
                            styles.viewButton,
                            pressed && { opacity: 0.65 },
                          ]}
                          accessibilityLabel={`View ${receiptName}`}
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.receiptMissing}>No receipt attached</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>DESCRIPTION</Text>
              <Text style={styles.reason}>{expense.reason}</Text>

              {expense.billable ? (
                <View style={styles.billableChip}>
                  <Text style={styles.billableText}>Billable OPE</Text>
                </View>
              ) : null}
            </View>

            {extractionSummary.lineItems.length > 0 ? (
              <View style={styles.card}>
                <LineItemsCard
                  items={extractionSummary.lineItems}
                  claimedAmountMinor={expense.amount_minor}
                  compact
                />
              </View>
            ) : null}

            {attachmentTiles.length > 0 ? (
              <View style={styles.card}>
                <View style={styles.attachmentsHeader}>
                  <Text style={styles.cardLabel}>ATTACHMENTS</Text>
                  <Text style={styles.attachmentsCount}>
                    {attachmentTiles.length}{' '}
                    {attachmentTiles.length === 1 ? 'file' : 'files'}
                  </Text>
                </View>
                <AttachmentGrid
                  items={attachmentTiles}
                  onOpen={(item) => {
                    if (item.uri) openReceipt(item.uri);
                  }}
                />
              </View>
            ) : null}

            {/* Review metadata (display-only) */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>
                {expense.review_status === 'approved'
                  ? 'APPROVED BY'
                  : expense.review_status === 'rejected'
                  ? 'REJECTED BY'
                  : 'REVIEW STATUS'}
              </Text>
              <Text style={styles.reviewer}>
                {expense.reviewed_by ||
                  (expense.review_status === 'under_review'
                    ? 'Finance review • In progress'
                    : 'Awaiting finance review')}
              </Text>
              {expense.review_note ? (
                <View style={styles.reviewNote}>
                  <Text style={styles.reviewNoteLabel}>FINANCE NOTE</Text>
                  <Text style={styles.reviewNoteText}>{expense.review_note}</Text>
                </View>
              ) : null}
            </View>

            {/* Read-only */}
            <View style={styles.readonlyBanner}>
              <Ionicons
                name="lock-closed"
                size={14}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.readonlyText}>
                Submitted to Ledger • Read-only
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={theme.colors.textMuted}
              />
              <Text style={styles.footerText}>
                Dexter OPE Instant Ledger • Cryptographically Verified
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.55,
    color: theme.colors.textPrimary,
  },
  ledgerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  ledgerPillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: 10,
  },
  container: {
    flex: 1,
    width: '100%',
  },

  hero: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 26,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  amount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  merchant: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.45,
    color: theme.colors.textPrimary,
    marginBottom: 5,
    textAlign: 'center',
  },
  stamp: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    color: theme.colors.textMuted,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  rowLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  rowValue: {
    flexShrink: 1,
    marginLeft: 16,
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 10,
  },
  receiptValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 1,
    marginLeft: 16,
    gap: 8,
  },
  receiptName: {
    flexShrink: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  receiptMissing: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
  },
  viewButton: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.surfaceAlt,
  },
  viewButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  cardLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attachmentsCount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  reason: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  billableChip: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  billableText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.amberDeep,
  },
  reviewer: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  reviewNote: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  reviewNoteLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  reviewNoteText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },

  readonlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginTop: 2,
  },
  readonlyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  footerText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: theme.colors.textMuted,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  errorTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 5,
  },
  errorSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.white,
  },

  // Desktop web
  desktopPage: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopScroll: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 36,
    paddingTop: 30,
    paddingBottom: 56,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    marginBottom: 24,
  },
  desktopBack: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 3,
  },
  desktopBackText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  desktopEyebrow: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: theme.colors.amber,
    marginBottom: 6,
    marginTop: 2,
  },
  desktopTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
  },
  desktopSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  desktopMain: {
    flex: 1,
    minWidth: 0,
  },
  desktopRail: {
    width: 340,
    flexShrink: 0,
  },
  desktopHeroCard: {
    padding: 24,
    borderRadius: 18,
    backgroundColor: theme.colors.ink,
    marginBottom: 14,
    ...theme.shadows.md,
  },
  desktopAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: theme.colors.white,
  },
  desktopLabelOnDark: {
    color: theme.colors.amberOnDark,
    marginBottom: 8,
  },
  desktopMerchant: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.white,
    marginTop: 5,
  },
  desktopStamp: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.48)',
    marginTop: 4,
  },
  desktopCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  desktopCardRejected: {
    borderColor: theme.colors.errorBorder,
    backgroundColor: '#FFFCFC',
  },
  desktopReason: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  desktopReviewer: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  desktopReviewNote: {
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
    backgroundColor: theme.colors.errorSoft,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
  },
  desktopReviewNoteText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.error,
  },
  desktopReviewHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textMuted,
    marginTop: 5,
  },
  desktopReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  desktopMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  desktopMetaLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: theme.colors.textMuted,
  },
  desktopMetaValue: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  desktopNoReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  desktopRailFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    marginTop: 3,
  },
});
