import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import { fetchExpenseById, ExpenseRecord, CATEGORY_OPTIONS, API_BASE_URL } from '../../utils/api';
import { formatINR, formatTime } from '../../utils/format';
import { PDFCard } from '../../components/PDFCard';

const FALLBACK_EXPENSES: ExpenseRecord[] = [
  {
    id: 'a1b2c3d4-0001-4000-a000-000000000001',
    reference_id: 'OPE-A7K291',
    user_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    amount_minor: 6840,
    currency: 'INR',
    expense_date: '2024-10-03',
    merchant: 'Uber India',
    category: 'cab_local_transport',
    category_label: 'Cab & local transport',
    reason: 'Cab to client office for project kickoff meeting',
    receipt_type: 'payment_screenshot',
    txn_ref: 'UBER-9A8F3D',
    invoice_no: null,
    tax_amount_minor: null,
    extraction_status: 'ok',
    possible_duplicate: false,
    created_at: '2024-10-03T10:15:00Z',
    attachment_count: 0,
  },
  {
    id: 'a1b2c3d4-0002-4000-a000-000000000002',
    reference_id: 'OPE-B3M472',
    user_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    amount_minor: 15200,
    currency: 'INR',
    expense_date: '2024-10-05',
    merchant: 'Ola Cabs',
    category: 'cab_local_transport',
    category_label: 'Cab & local transport',
    reason: 'Airport pickup — Bengaluru domestic terminal',
    receipt_type: 'payment_screenshot',
    txn_ref: 'OLA-X22K91',
    invoice_no: null,
    tax_amount_minor: null,
    extraction_status: 'ok',
    possible_duplicate: false,
    created_at: '2024-10-05T08:30:00Z',
    attachment_count: 0,
  },
  {
    id: 'a1b2c3d4-0003-4000-a000-000000000003',
    reference_id: 'OPE-C9T583',
    user_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    amount_minor: 43500,
    currency: 'INR',
    expense_date: '2024-10-08',
    merchant: 'Swiggy',
    category: 'team_meals',
    category_label: 'Team meals',
    reason: 'Team lunch ordered via Swiggy for sprint retro',
    receipt_type: 'bill_photo',
    txn_ref: null,
    invoice_no: 'SWG-2024-78431',
    tax_amount_minor: 7830,
    extraction_status: 'ok',
    possible_duplicate: false,
    created_at: '2024-10-08T13:00:00Z',
    attachment_count: 0,
  },
  {
    id: 'a1b2c3d4-0004-4000-a000-000000000004',
    reference_id: 'OPE-D1W694',
    user_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    amount_minor: 32000,
    currency: 'INR',
    expense_date: '2024-10-11',
    merchant: 'Blue Tokai Coffee',
    category: 'client_meals_entertainment',
    category_label: 'Client meals & entertainment',
    reason: 'Coffee meeting with client stakeholders at Blue Tokai, Koramangala',
    receipt_type: 'bill_photo',
    txn_ref: null,
    invoice_no: 'BTC-10-0219',
    tax_amount_minor: 5760,
    extraction_status: 'ok',
    possible_duplicate: false,
    created_at: '2024-10-11T16:45:00Z',
    attachment_count: 0,
  },
  {
    id: 'a1b2c3d4-0005-4000-a000-000000000005',
    reference_id: 'OPE-E5X705',
    user_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    amount_minor: 875000,
    currency: 'INR',
    expense_date: '2024-10-14',
    merchant: 'Taj Hotel',
    category: 'travel',
    category_label: 'Travel (flights/train/hotel)',
    reason: 'Hotel stay for 2-day client workshop in Mumbai',
    receipt_type: 'bill_photo',
    txn_ref: null,
    invoice_no: 'TAJ-MUM-20241014-882',
    tax_amount_minor: 157500,
    extraction_status: 'manual',
    possible_duplicate: false,
    created_at: '2024-10-14T09:00:00Z',
    attachment_count: 0,
  },
];

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const containerMaxWidth = width > 460 ? 420 : width;

  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    fetchExpenseById(params.id)
      .then((data) => {
        setExpense(data);
        setLoading(false);
      })
      .catch((err) => {
        // Fallback check against seed sample items if backend is slow/offline
        const match = FALLBACK_EXPENSES.find(
          (f) =>
            f.id.toLowerCase() === params.id.toLowerCase() ||
            f.reference_id.toLowerCase() === params.id.toLowerCase()
        );
        if (match) {
          setExpense(match);
        } else {
          setError(err.message || 'Expense could not be loaded');
        }
        setLoading(false);
      });
  }, [params.id]);

  const getCategoryLabel = (key?: string) => {
    const opt = CATEGORY_OPTIONS.find((c) => c.key === key);
    return opt?.label || key || 'General';
  };

  const formatISTDate = (isoDateStr?: string) => {
    if (!isoDateStr) return '';
    const d = new Date(isoDateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Top Bar ───────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
          accessibilityLabel="Back to expenses"
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Expense</Text>
        <View style={styles.refPill}>
          <Text style={styles.refPillText}>
            {expense?.reference_id || params.id}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.indigo} />
              <Text style={styles.loadingText}>Loading expense details…</Text>
            </View>
          ) : error || !expense ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
              <Text style={styles.errorTitle}>Expense Not Found</Text>
              <Text style={styles.errorSub}>{error || 'The requested expense was not found.'}</Text>
              <Pressable
                onPress={() => router.replace('/home')}
                style={styles.returnBtn}
              >
                <Text style={styles.returnBtnText}>Back to Expenses Feed</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* ── Top Hero: Amount, Merchant, Date ─────────── */}
              <View style={styles.heroSection}>
                <View style={styles.statusPillTop}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusTextTop}>SUBMITTED</Text>
                </View>

                <Text style={styles.amountDisplay}>
                  {formatINR(expense.amount_minor)}
                </Text>

                <Text style={styles.merchantName}>
                  {expense.merchant || 'Expense Claim'}
                </Text>

                <Text style={styles.dateStamp}>
                  {formatISTDate(expense.created_at || expense.expense_date)} •{' '}
                  {formatTime(new Date(expense.created_at))}
                </Text>
              </View>

              {/* ── Details Card 1: Category & Receipt ──────── */}
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardFieldLabel}>Category</Text>
                  <Text style={styles.cardFieldValue}>
                    {getCategoryLabel(expense.category)}
                  </Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardRow}>
                  <Text style={styles.cardFieldLabel}>Receipt</Text>
                  <Text style={styles.cardFieldValue}>
                    {expense.attachment_count > 0
                      ? `${expense.attachment_count} attached`
                      : expense.receipt_type === 'none'
                      ? 'No receipt attached'
                      : 'None'}
                  </Text>
                </View>

                {/* Render any linked attachments */}
                {expense.attachments && expense.attachments.length > 0 && (
                  <View style={{ marginTop: theme.spacing.sm }}>
                    {expense.attachments.map((att) => {
                      const fileUrl = `${API_BASE_URL}/expenses/${expense.id}/attachments/${att.id}`;
                      const isPdf = att.mime === 'application/pdf';
                      const filename = att.filename || `receipt_${expense.reference_id.toLowerCase()}.${isPdf ? 'pdf' : 'jpg'}`;

                      if (isPdf) {
                        return (
                          <PDFCard
                            key={att.id}
                            filename={filename}
                            viewUrl={fileUrl}
                          />
                        );
                      }

                      return (
                        <Pressable
                          key={att.id}
                          onPress={() => {
                            if (typeof window !== 'undefined') window.open(fileUrl, '_blank');
                          }}
                          style={({ pressed }) => [
                            styles.imageAttachmentCard,
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Image
                            source={{ uri: fileUrl }}
                            style={styles.detailThumbnail}
                            resizeMode="cover"
                          />
                          <View style={styles.imageAttachmentInfo}>
                            <Text style={styles.imageAttachmentName} numberOfLines={1}>
                              {filename}
                            </Text>
                            <Text style={styles.viewLink}>View full image</Text>
                          </View>
                          <Ionicons name="open-outline" size={16} color={theme.colors.indigo} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {expense.txn_ref && (
                  <>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardRow}>
                      <Text style={styles.cardFieldLabel}>Txn Ref / UPI</Text>
                      <Text style={styles.cardFieldValue}>{expense.txn_ref}</Text>
                    </View>
                  </>
                )}

                {expense.invoice_no && (
                  <>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardRow}>
                      <Text style={styles.cardFieldLabel}>Invoice No</Text>
                      <Text style={styles.cardFieldValue}>{expense.invoice_no}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* ── Details Card 2: Description / Purpose ──── */}
              <View style={styles.card}>
                <Text style={styles.sectionHeaderLabel}>DESCRIPTION</Text>
                <Text style={styles.reasonBody}>{expense.reason}</Text>
              </View>

              {/* ── Read-only Status Banner ──────────────────── */}
              <View style={styles.readonlyBanner}>
                <Ionicons name="lock-closed" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.readonlyText}>Submitted • Read-only</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
  },
  refPill: {
    backgroundColor: theme.colors.bgSecondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  refPillText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  container: {
    width: '100%',
  },

  // Centered State
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl * 2,
  },
  loadingText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  errorTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingMedium,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  errorSub: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  returnBtn: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  returnBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.white,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  statusPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  statusTextTop: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.success,
    letterSpacing: 0.5,
  },
  amountDisplay: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.displayLarge,
    color: theme.colors.textPrimary,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  merchantName: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingLarge,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  dateStamp: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },

  // Cards
  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  cardFieldLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  cardFieldValue: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  cardFieldValueMuted: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.md,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imageAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailThumbnail: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.border,
  },
  imageAttachmentInfo: {
    flex: 1,
  },
  imageAttachmentName: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  receiptFilename: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
  },
  viewLink: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    fontWeight: '700',
    color: theme.colors.indigo,
    marginLeft: 4,
  },

  // Section Header Label
  sectionHeaderLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
    marginBottom: theme.spacing.sm,
  },
  reasonBody: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },

  // Read-only Banner
  readonlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  readonlyText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
