import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import {
  API_BASE_URL,
  AttachmentRecord,
  ExpenseRecord,
  fetchExpenseById,
  getCategoryIcon,
  getCategoryLabel,
  reviewExpense,
} from '../../utils/api';
import {
  formatDate,
  formatINR,
  formatTime,
  parseAmountToPaise,
} from '../../utils/format';
import { reviewStatusMeta } from '../../utils/status';
import { summarizeExtraction } from '../../utils/extraction';
import { AttachmentGrid, AttachmentTile } from '../../components/AttachmentGrid';
import { LineItemsCard } from '../../components/LineItemsCard';
import { useAppRole } from '../../components/RoleContext';

const EMPLOYEE_NAME = 'Pushpendra Suryawanshi';
const EMPLOYEE_ROLE = 'Investment Banking • OPE';
const REVIEWER_LABEL = 'Finance Team • OPE';

function parseDateOnly(value?: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function stamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date)} • ${formatTime(date)}`;
}

function receiptTypeLabel(type: ExpenseRecord['receipt_type']): string {
  if (type === 'payment_screenshot') return 'UPI / payment proof';
  if (type === 'bill_photo') return 'Bill photo or PDF';
  return 'No receipt';
}

function openFile(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url).catch(() => {});
}

function StatusPill({ status }: { status: ExpenseRecord['review_status'] }) {
  const meta = reviewStatusMeta(status);
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: meta.backgroundColor, borderColor: meta.borderColor },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function formatReadAmount(value: string): string {
  const paise = parseAmountToPaise(value);
  if (paise !== null && paise > 0) return formatINR(paise);
  return value ? `₹${value}` : '—';
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone =
    percent >= 75
      ? theme.colors.success
      : percent >= 50
      ? theme.colors.amber
      : theme.colors.error;
  return (
    <View style={styles.confidenceRow}>
      <Text style={styles.confidenceLabel}>{label.toUpperCase()}</Text>
      <View style={styles.confidenceTrack}>
        <View
          style={[
            styles.confidenceFill,
            { width: `${percent}%`, backgroundColor: tone },
          ]}
        />
      </View>
      <Text style={[styles.confidenceValue, { color: tone }]}>{percent}%</Text>
    </View>
  );
}

export default function FinanceDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; from?: string }>();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;
  const { setRole } = useAppRole();

  const [expense, setExpense] = useState<ExpenseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(
    null
  );

  useEffect(() => {
    setRole('finance');
  }, [setRole]);

  useEffect(() => {
    if (!params.id) {
      setLoadError('No claim reference was provided.');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    fetchExpenseById(params.id)
      .then((record) => {
        if (!active) return;
        setExpense(record);
        setLoading(false);
      })
      .catch((error: any) => {
        if (!active) return;
        setLoadError(error?.message || 'This claim could not be loaded.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  const extraction = useMemo(
    () => summarizeExtraction(expense?.extraction_json),
    [expense?.extraction_json]
  );

  const attachments: AttachmentTile[] = (expense?.attachments || []).map(
    (item: AttachmentRecord) => ({
      key: item.id,
      uri: `${API_BASE_URL}/expenses/${expense?.id}/attachments/${item.id}`,
      name: item.filename || 'receipt',
      mime: item.mime,
      isPdf: item.mime === 'application/pdf',
    })
  );

  const currentMeta = reviewStatusMeta(expense?.review_status || 'submitted');
  const alreadyReviewed =
    expense?.review_status === 'approved' || expense?.review_status === 'rejected';

  const goBack = () => {
    router.replace({
      pathname: '/finance',
      params: { tab: params.from || 'pending' },
    });
  };

  const decide = async (action: 'approve' | 'reject') => {
    if (!expense || pendingAction) return;
    const cleanNote = note.trim();
    if (action === 'reject' && cleanNote.length < 3) {
      setActionError('Add a short reason so the employee knows what to fix.');
      return;
    }
    setActionError(null);
    setPendingAction(action);
    try {
      await reviewExpense(expense.reference_id, action, cleanNote, REVIEWER_LABEL);
      router.replace({
        pathname: '/finance',
        params: {
          tab: action === 'approve' ? 'approved' : 'rejected',
          reviewed: String(Date.now()),
        },
      });
    } catch (error: any) {
      setActionError(
        error?.detail ||
          error?.message ||
          'The decision could not be saved. Please try again.'
      );
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={theme.colors.amber} />
          <Text style={styles.centeredText}>Opening claim…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !expense) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <View style={styles.centeredIcon}>
            <Ionicons
              name="document-text-outline"
              size={26}
              color={theme.colors.textMuted}
            />
          </View>
          <Text style={styles.centeredTitle}>Claim not found</Text>
          <Text style={styles.centeredText}>
            {loadError || 'This claim is no longer in the ledger.'}
          </Text>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.primarySmall,
              pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={styles.primarySmallText}>Back to finance</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const content = (
    <>
      <View style={desktop ? styles.header : styles.mobileHeader}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.62 },
          ]}
          hitSlop={8}
          accessibilityLabel="Back to claims inbox"
        >
          <Ionicons
            name="arrow-back"
            size={desktop ? 17 : 21}
            color={theme.colors.textPrimary}
          />
          {desktop ? <Text style={styles.backText}>Claims inbox</Text> : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>FINANCE REVIEW</Text>
          <Text style={desktop ? styles.title : styles.mobileTitle}>
            {expense.merchant || 'Expense claim'}
          </Text>
          <Text style={styles.subtitle}>
            {expense.reference_id} • {formatDate(parseDateOnly(expense.expense_date))} •{' '}
            {EMPLOYEE_NAME}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <StatusPill status={expense.review_status} />
          {desktop ? (
            <View style={styles.refPill}>
              <Text style={styles.refPillText}>{expense.reference_id}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={desktop ? styles.grid : undefined}>
        <View style={desktop ? styles.mainCol : undefined}>
          {/* Claim summary */}
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>CLAIM AMOUNT</Text>
                <Text style={desktop ? styles.amount : styles.mobileAmount}>
                  {formatINR(expense.amount_minor)}
                </Text>
                <Text style={styles.amountMeta}>
                  {expense.currency} • {getCategoryLabel(expense.category)}
                </Text>
              </View>
              <View style={styles.categoryIcon}>
                <Ionicons
                  name={getCategoryIcon(expense.category) as any}
                  size={24}
                  color={theme.colors.iconInk}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailGrid}>
              <DetailRow
                label="EXPENSE DATE"
                value={formatDate(parseDateOnly(expense.expense_date))}
              />
              <DetailRow label="CATEGORY" value={getCategoryLabel(expense.category)} />
              <DetailRow label="RECEIPT" value={receiptTypeLabel(expense.receipt_type)} />
              <DetailRow label="BILLABLE" value={expense.billable ? 'Billable OPE' : 'Non-billable'} />
              <DetailRow label="TXN REF" value={expense.txn_ref || '—'} mono />
              <DetailRow label="INVOICE NO" value={expense.invoice_no || '—'} mono />
              <DetailRow
                label="TAX"
                value={
                  expense.tax_amount_minor
                    ? formatINR(expense.tax_amount_minor)
                    : '—'
                }
              />
              <DetailRow label="SUBMITTED" value={stamp(expense.created_at)} />
            </View>
          </View>

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>BUSINESS PURPOSE</Text>
            <Text style={styles.reason}>{expense.reason}</Text>
            <View style={styles.reasonMetaRow}>
              <View style={styles.billableChip}>
                <Text style={styles.billableText}>
                  {expense.billable ? 'Billable OPE' : 'Non-billable'}
                </Text>
              </View>
              <Text style={styles.reasonMeta}>
                Submitted by {EMPLOYEE_NAME}
              </Text>
            </View>
          </View>

          {/* Gemini extraction */}
          <View style={styles.card}>
            <View style={styles.aiHeader}>
              <View style={styles.aiHeaderLeft}>
                <View style={styles.aiIcon}>
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color={theme.colors.amberDeep}
                  />
                </View>
                <View>
                  <Text style={styles.cardLabel}>GEMINI EXTRACTION</Text>
                  <Text style={styles.aiSubtitle}>
                    {expense.extraction_json
                      ? 'What the model read from the receipt or payment proof.'
                      : 'No AI draft is stored for this legacy claim.'}
                  </Text>
                </View>
              </View>
              {extraction.averageConfidence !== null ? (
                <View style={styles.confidencePill}>
                  <Text style={styles.confidencePillText}>
                    {extraction.averageConfidence}% AVG
                  </Text>
                </View>
              ) : (
                <View style={styles.legacyPill}>
                  <Text style={styles.legacyPillText}>MANUAL</Text>
                </View>
              )}
            </View>

            {expense.extraction_json ? (
              <>
                <View style={styles.detailGrid}>
                  <DetailRow
                    label="READ AMOUNT"
                    value={formatReadAmount(extraction.fields.amount)}
                  />
                  <DetailRow
                    label="READ DATE"
                    value={
                      extraction.fields.date
                        ? formatDate(parseDateOnly(extraction.fields.date))
                        : '—'
                    }
                  />
                  <DetailRow
                    label="READ PAYEE"
                    value={extraction.fields.merchant || '—'}
                  />
                  <DetailRow
                    label="READ RECEIPT"
                    value={receiptTypeLabel(
                      (extraction.raw?.receipt_type as ExpenseRecord['receipt_type']) ||
                        expense.receipt_type
                    )}
                  />
                </View>

                {extraction.lineItems.length > 0 ? (
                  <LineItemsCard
                    items={extraction.lineItems}
                    claimedAmountMinor={expense.amount_minor}
                    title="READ LINE ITEMS"
                    subtitle={`${extraction.lineItems.length} entries read from the itemized bill`}
                    compact
                  />
                ) : null}

                {Object.keys(extraction.confidence).length > 0 ? (
                  <View style={styles.confidenceBlock}>
                    <Text style={styles.subLabel}>MODEL CONFIDENCE</Text>
                    {Object.entries(extraction.confidence).map(([key, value]) => (
                      <ConfidenceBar key={key} label={key} value={value} />
                    ))}
                  </View>
                ) : null}

                {extraction.notices.length > 0 || extraction.conflicts.length > 0 ? (
                  <View style={styles.notices}>
                    {extraction.conflicts.map((notice, index) => (
                      <View key={`conflict-${index}`} style={styles.noticeRow}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={13}
                          color={theme.colors.amberDeep}
                        />
                        <Text style={styles.noticeText}>{notice}</Text>
                      </View>
                    ))}
                    {extraction.notices.map((notice, index) => (
                      <View key={`notice-${index}`} style={styles.noticeRow}>
                        <Ionicons
                          name="information-circle-outline"
                          size={13}
                          color={theme.colors.textSecondary}
                        />
                        <Text style={styles.noticeText}>{notice}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.legacyText}>
                This seeded claim predates the AI draft store. The employee's
                submitted fields and the receipt below remain the source of truth.
              </Text>
            )}
          </View>

          {/* Attachments */}
          <View style={styles.card}>
            <View style={styles.attachmentHeader}>
              <View>
                <Text style={styles.cardLabel}>ATTACHMENTS</Text>
                <Text style={styles.aiSubtitle}>
                  {attachments.length > 0
                    ? `${attachments.length} ${
                        attachments.length === 1 ? 'file' : 'files'
                      } on this claim`
                    : 'No files attached to this claim'}
                </Text>
              </View>
              {attachments.length > 0 ? (
                <View style={styles.attachmentCount}>
                  <Ionicons
                    name="attach-outline"
                    size={13}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.attachmentCountText}>{attachments.length}</Text>
                </View>
              ) : null}
            </View>
            {attachments.length > 0 ? (
              <AttachmentGrid
                items={attachments}
                size={desktop ? 92 : 76}
                onOpen={(item) => {
                  if (item.uri) openFile(item.uri);
                }}
              />
            ) : (
              <View style={styles.noFiles}>
                <Ionicons
                  name="document-outline"
                  size={18}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.noFilesText}>
                  This claim was filed without a bill or payment proof.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={desktop ? styles.rail : undefined}>
          {/* Employee */}
          <View style={[styles.card, styles.railCard]}>
            <Text style={styles.cardLabel}>SUBMITTED BY</Text>
            <View style={styles.employeeRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>PS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.employeeName}>{EMPLOYEE_NAME}</Text>
                <Text style={styles.employeeRole}>{EMPLOYEE_ROLE}</Text>
              </View>
            </View>
            <View style={styles.railDivider} />
            <View style={styles.railMetaRow}>
              <Text style={styles.railMetaLabel}>Submitted</Text>
              <Text style={styles.railMetaValue}>{stamp(expense.created_at)}</Text>
            </View>
            <View style={styles.railMetaRow}>
              <Text style={styles.railMetaLabel}>Reference</Text>
              <Text style={styles.railMetaValue}>{expense.reference_id}</Text>
            </View>
            <View style={styles.railMetaRow}>
              <Text style={styles.railMetaLabel}>AI status</Text>
              <Text style={styles.railMetaValue}>
                {expense.extraction_status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Decision */}
          <View style={[styles.railCard, styles.decisionCard]}>
            <View style={styles.decisionTop}>
              <Text style={styles.decisionLabel}>REVIEW DECISION</Text>
              <StatusPill status={expense.review_status} />
            </View>

            {alreadyReviewed ? (
              <View style={styles.currentDecision}>
                <View style={styles.currentDecisionRow}>
                  <Ionicons
                    name={
                      expense.review_status === 'approved'
                        ? 'checkmark-circle'
                        : 'close-circle'
                    }
                    size={15}
                    color={currentMeta.color}
                  />
                  <Text style={styles.currentDecisionTitle}>
                    {expense.review_status === 'approved'
                      ? 'Payment approved'
                      : 'Payment rejected'}
                  </Text>
                </View>
                <Text style={styles.currentDecisionMeta}>
                  {expense.reviewed_by || REVIEWER_LABEL}
                  {expense.reviewed_at ? ` • ${stamp(expense.reviewed_at)}` : ''}
                </Text>
                {expense.review_note ? (
                  <Text style={styles.currentDecisionNote}>
                    “{expense.review_note}”
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.decisionHint}>
                Approving clears the payment. Rejecting sends the claim back to
                the employee with your note.
              </Text>
            )}

            <Text style={styles.noteLabel}>
              NOTE {alreadyReviewed ? 'UPDATE (OPTIONAL)' : '(REQUIRED TO REJECT)'}
            </Text>
            <TextInput
              value={note}
              onChangeText={(value) => {
                setNote(value);
                if (actionError) setActionError(null);
              }}
              placeholder={
                expense.review_status === 'approved'
                  ? 'Add context for the employee (optional)'
                  : 'What should the employee know?'
              }
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.noteInput}
              multiline
              maxLength={500}
              editable={!pendingAction}
            />

            {actionError ? (
              <View style={styles.actionError}>
                <Ionicons
                  name="alert-circle-outline"
                  size={13}
                  color={theme.colors.errorBorder}
                />
                <Text style={styles.actionErrorText}>{actionError}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => decide('approve')}
              disabled={!!pendingAction}
              style={({ pressed }) => [
                styles.approveButton,
                pressed && { opacity: 0.9 },
                pendingAction && { opacity: 0.65 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Approve payment"
            >
              {pendingAction === 'approve' ? (
                <ActivityIndicator size="small" color={theme.colors.ink} />
              ) : (
                <Ionicons
                  name="checkmark"
                  size={17}
                  color={theme.colors.ink}
                />
              )}
              <Text style={styles.approveButtonText}>
                {pendingAction === 'approve' ? 'Approving…' : 'Approve payment'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => decide('reject')}
              disabled={!!pendingAction}
              style={({ pressed }) => [
                styles.rejectButton,
                pressed && { opacity: 0.82 },
                pendingAction && { opacity: 0.65 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reject payment"
            >
              {pendingAction === 'reject' ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.errorBorder}
                />
              ) : (
                <Ionicons
                  name="close"
                  size={17}
                  color={theme.colors.errorBorder}
                />
              )}
              <Text style={styles.rejectButtonText}>
                {pendingAction === 'reject' ? 'Rejecting…' : 'Reject payment'}
              </Text>
            </Pressable>

            <Text style={styles.decisionFoot}>
              Recorded as Finance Team • OPE. The employee sees this decision
              immediately.
            </Text>
          </View>

          <View style={styles.railFoot}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.railFootText}>
              Encrypted in transit • Synced with the employee ledger
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.mobileScroll,
          { paddingBottom: 30 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopPage: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopScroll: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 56,
  },
  mobileScroll: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  centeredIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centeredTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  centeredText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 380,
  },
  primarySmall: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.ink,
  },
  primarySmallText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginBottom: 24,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 18,
  },
  backButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 4,
  },
  backText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  eyebrow: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: theme.colors.amber,
    marginBottom: 6,
    marginTop: 2,
  },
  title: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
  },
  mobileTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  refPillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  mainCol: {
    flex: 1,
    minWidth: 0,
  },
  rail: {
    width: 344,
    flexShrink: 0,
  },
  card: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  railCard: {
    padding: 17,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  amount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.6,
    color: theme.colors.textPrimary,
  },
  mobileAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: theme.colors.textPrimary,
  },
  amountMeta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 17,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 15,
  },
  detailRow: {
    width: '50%',
    paddingRight: 12,
  },
  detailLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: theme.colors.textMuted,
    marginBottom: 3,
  },
  detailValue: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    color: theme.colors.textPrimary,
  },
  detailValueMono: {
    fontSize: 11,
    letterSpacing: 0.2,
    color: theme.colors.textSecondary,
  },
  reason: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  reasonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 13,
    flexWrap: 'wrap',
  },
  billableChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  billableText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '700',
    color: theme.colors.success,
  },
  reasonMeta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 15,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: theme.colors.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    lineHeight: 14,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  confidencePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  confidencePillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: theme.colors.amberDeep,
  },
  legacyPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  legacyPillText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: theme.colors.textMuted,
  },
  confidenceBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    gap: 7,
  },
  subLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabel: {
    width: 66,
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: theme.colors.textSecondary,
  },
  confidenceTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceValue: {
    width: 34,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
  },
  notices: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    gap: 7,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noticeText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    lineHeight: 14,
    color: theme.colors.textSecondary,
  },
  legacyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  attachmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 13,
  },
  attachmentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceAlt,
  },
  attachmentCountText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  noFiles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 13,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  noFilesText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: theme.colors.textSecondary,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.white,
  },
  employeeName: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  employeeRole: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  railDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 13,
  },
  railMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 7,
  },
  railMetaLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  railMetaValue: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  decisionCard: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
    ...theme.shadows.md,
  },
  decisionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 11,
  },
  decisionLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: theme.colors.amberOnDark,
  },
  decisionHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.52)',
    marginBottom: 13,
  },
  currentDecision: {
    padding: 11,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 13,
  },
  currentDecisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentDecisionTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  currentDecisionMeta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    color: 'rgba(255,255,255,0.42)',
    marginTop: 4,
  },
  currentDecisionNote: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.68)',
    marginTop: 7,
  },
  noteLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: 'rgba(255,255,255,0.42)',
    marginBottom: 6,
  },
  noteInput: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 11,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.white,
    textAlignVertical: 'top',
  },
  actionError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 9,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(180,35,24,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(254,205,202,0.24)',
  },
  actionErrorText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 13,
    color: theme.colors.errorBorder,
  },
  approveButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.amberOnDark,
    marginTop: 12,
  },
  approveButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  rejectButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254,205,202,0.28)',
    marginTop: 8,
  },
  rejectButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.errorBorder,
  },
  decisionFoot: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    lineHeight: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 10,
  },
  railFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  railFootText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    color: theme.colors.textMuted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
});
