import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import {
  ExpenseRecord,
  ReviewStatus,
  fetchAllExpenses,
  getCategoryIcon,
  getCategoryLabel,
} from '../utils/api';
import { formatDate, formatINR, formatTime } from '../utils/format';
import { reviewStatusMeta } from '../utils/status';
import { summarizeExtraction } from '../utils/extraction';
import { useAppRole } from '../components/RoleContext';

type TabKey = 'pending' | 'approved' | 'rejected';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'pending', label: 'Needs review', icon: 'time-outline' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline' },
];

const EMPLOYEE_NAME = 'Pushpendra Suryawanshi';

function normalizeTab(value?: string): TabKey {
  if (value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

function isPending(status: ReviewStatus): boolean {
  return status === 'submitted' || status === 'under_review';
}

function recordDate(record: ExpenseRecord): Date {
  const raw = record.created_at || record.expense_date;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function submissionLabel(record: ExpenseRecord): string {
  const date = recordDate(record);
  return `${formatDate(date)} • ${formatTime(date)}`;
}

function StatusPill({ status, compact }: { status: ReviewStatus; compact?: boolean }) {
  const meta = reviewStatusMeta(status);
  return (
    <View
      style={[
        styles.statusPill,
        compact && styles.statusPillCompact,
        { backgroundColor: meta.backgroundColor, borderColor: meta.borderColor },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
      <Text
        style={[styles.statusText, compact && styles.statusTextCompact, { color: meta.color }]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

function MetricCard({
  label,
  amount,
  count,
  tone,
  icon,
}: {
  label: string;
  amount: string;
  count: number;
  tone: 'dark' | 'success' | 'error';
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const dark = tone === 'dark';
  return (
    <View
      style={[
        styles.metricCard,
        dark && styles.metricCardDark,
        tone === 'success' && styles.metricCardSuccess,
        tone === 'error' && styles.metricCardError,
      ]}
    >
      <View style={styles.metricTop}>
        <Text
          style={[
            styles.metricLabel,
            dark && styles.metricLabelDark,
            tone === 'success' && { color: theme.colors.success },
            tone === 'error' && { color: theme.colors.error },
          ]}
        >
          {label}
        </Text>
        <Ionicons
          name={icon}
          size={15}
          color={
            dark
              ? 'rgba(232,201,142,0.85)'
              : tone === 'success'
              ? theme.colors.success
              : theme.colors.error
          }
        />
      </View>
      <Text style={[styles.metricAmount, dark && styles.metricAmountDark]}>
        {amount}
      </Text>
      <Text style={[styles.metricFoot, dark && styles.metricFootDark]}>
        {count} {count === 1 ? 'claim' : 'claims'}
        {dark ? ' awaiting a decision' : tone === 'success' ? ' cleared' : ' returned'}
      </Text>
    </View>
  );
}

function ClaimRow({
  expense,
  onPress,
  mobile,
}: {
  expense: ExpenseRecord;
  onPress: () => void;
  mobile?: boolean;
}) {
  const extraction = summarizeExtraction(expense.extraction_json);
  const hasAi = !!expense.extraction_json;

  if (mobile) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.mobileRow, pressed && { opacity: 0.72 }]}
        accessibilityRole="button"
        accessibilityLabel={`Open claim ${expense.reference_id}`}
      >
        <View style={styles.rowIcon}>
          <Ionicons
            name={getCategoryIcon(expense.category) as any}
            size={19}
            color={theme.colors.iconInk}
          />
        </View>
        <View style={styles.mobileRowBody}>
          <Text style={styles.rowMerchant} numberOfLines={1}>
            {expense.merchant || 'Expense claim'}
          </Text>
          <Text style={styles.rowReason} numberOfLines={1}>
            {expense.reason}
          </Text>
          <View style={styles.mobileRowMeta}>
            <Text style={styles.rowMetaText}>{submissionLabel(expense)}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.rowMetaText}>{expense.reference_id}</Text>
          </View>
        </View>
        <View style={styles.mobileRowRight}>
          <Text style={styles.rowAmount}>{formatINR(expense.amount_minor)}</Text>
          <StatusPill status={expense.review_status} compact />
          {hasAi && extraction.averageConfidence !== null ? (
            <View style={styles.aiChip}>
              <Ionicons name="sparkles" size={9} color={theme.colors.amberDeep} />
              <Text style={styles.aiChipText}>{extraction.averageConfidence}%</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open claim ${expense.reference_id}`}
    >
      <View style={styles.rowClaim}>
        <View style={styles.rowIcon}>
          <Ionicons
            name={getCategoryIcon(expense.category) as any}
            size={19}
            color={theme.colors.iconInk}
          />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowMerchant} numberOfLines={1}>
            {expense.merchant || 'Expense claim'}
          </Text>
          <Text style={styles.rowReason} numberOfLines={1}>
            {expense.reason}
          </Text>
          <View style={styles.rowMeta}>
            <Text style={styles.rowMetaText}>{expense.reference_id}</Text>
            <View style={styles.metaDot} />
            <Text style={[styles.rowMetaText, styles.rowMetaCategory]} numberOfLines={1}>
              {getCategoryLabel(expense.category)}
            </Text>
            {hasAi && extraction.averageConfidence !== null ? (
              <>
                <View style={styles.metaDot} />
                <View style={styles.aiChip}>
                  <Ionicons
                    name="sparkles"
                    size={9}
                    color={theme.colors.amberDeep}
                  />
                  <Text style={styles.aiChipText}>
                    AI {extraction.averageConfidence}%
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.rowEmployee}>
        <Text style={styles.rowEmployeeName} numberOfLines={1}>
          {EMPLOYEE_NAME}
        </Text>
        <Text style={styles.rowEmployeeMeta}>{submissionLabel(expense)}</Text>
      </View>
      <Text style={styles.rowAmount}>{formatINR(expense.amount_minor)}</Text>
      <View style={styles.rowStatus}>
        <StatusPill status={expense.review_status} />
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={theme.colors.borderStrong}
      />
    </Pressable>
  );
}

export default function FinanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string; reviewed?: string }>();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;
  const { setRole } = useAppRole();

  const [tab, setTab] = useState<TabKey>(normalizeTab(params.tab));
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const initialFocus = useRef(true);

  useEffect(() => {
    setRole('finance');
  }, [setRole]);

  useEffect(() => {
    setTab(normalizeTab(params.tab));
  }, [params.tab]);

  const load = useCallback(async () => {
    try {
      const items = await fetchAllExpenses();
      setExpenses(items);
      setError(null);
    } catch (fetchError: any) {
      setError(
        fetchError?.message ||
          'Could not load the finance ledger. Check the connection and try again.'
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load, reloadKey, params.reviewed]);

  // Returning to the finance workspace should always show claims filed while
  // the employee view was open.
  useFocusEffect(
    useCallback(() => {
      if (initialFocus.current) {
        initialFocus.current = false;
        return;
      }
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ordered = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => recordDate(b).getTime() - recordDate(a).getTime()
      ),
    [expenses]
  );

  const pending = ordered.filter((expense) => isPending(expense.review_status));
  const approved = ordered.filter((expense) => expense.review_status === 'approved');
  const rejected = ordered.filter((expense) => expense.review_status === 'rejected');

  const buckets: Record<TabKey, ExpenseRecord[]> = {
    pending,
    approved,
    rejected,
  };

  const total = (items: ExpenseRecord[]) =>
    items.reduce((sum, expense) => sum + expense.amount_minor, 0);
  const visible = buckets[tab];
  const activeTab = TABS.find((item) => item.key === tab) || TABS[0];

  const openClaim = (expense: ExpenseRecord) => {
    router.push({
      pathname: '/finance/[id]',
      params: { id: expense.reference_id || expense.id, from: tab },
    });
  };

  const changeTab = (next: TabKey) => {
    setTab(next);
    router.setParams({ tab: next });
  };

  const exitFinance = () => {
    setRole('employee');
    router.replace('/home');
  };

  const headerBlock = (
    <View style={desktop ? styles.header : styles.mobileHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>FINANCE • OPE LEDGER</Text>
        <Text style={desktop ? styles.title : styles.mobileTitle}>Claims inbox</Text>
        <Text style={styles.subtitle}>
          Every employee claim, receipt, and Gemini reading in one place.
        </Text>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.financeBadge}>
          <Ionicons
            name="shield-checkmark-outline"
            size={13}
            color={theme.colors.amberDeep}
          />
          <Text style={styles.financeBadgeText}>FINANCE TEAM</Text>
        </View>
        <Pressable
          onPress={exitFinance}
          style={({ pressed }) => [
            styles.ghostButton,
            pressed && { opacity: 0.72 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Switch to employee workspace"
        >
          <Ionicons
            name="person-outline"
            size={14}
            color={theme.colors.textPrimary}
          />
          <Text style={styles.ghostButtonText}>Employee view</Text>
        </Pressable>
      </View>
    </View>
  );

  const metricsBlock = (
    <View style={styles.metrics}>
      <MetricCard
        label="AWAITING REVIEW"
        amount={formatINR(total(pending))}
        count={pending.length}
        tone="dark"
        icon="time-outline"
      />
      <MetricCard
        label="APPROVED"
        amount={formatINR(total(approved))}
        count={approved.length}
        tone="success"
        icon="checkmark-circle-outline"
      />
      <MetricCard
        label="REJECTED"
        amount={formatINR(total(rejected))}
        count={rejected.length}
        tone="error"
        icon="close-circle-outline"
      />
    </View>
  );

  const tabsBlock = (
    <View style={styles.tabs}>
      {TABS.map((item) => {
        const active = item.key === tab;
        return (
          <Pressable
            key={item.key}
            onPress={() => changeTab(item.key)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && !active && { opacity: 0.72 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Ionicons
              name={item.icon}
              size={14}
              color={active ? theme.colors.white : theme.colors.textSecondary}
            />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {item.label}
            </Text>
            <View style={[styles.tabCount, active && styles.tabCountActive]}>
              <Text
                style={[
                  styles.tabCountText,
                  active && styles.tabCountTextActive,
                ]}
              >
                {buckets[item.key].length}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const listBlock = loading ? (
    <View style={styles.loadingBox}>
      <ActivityIndicator size="small" color={theme.colors.amber} />
      <Text style={styles.loadingText}>Loading claims…</Text>
    </View>
  ) : error ? (
    <View style={styles.errorBox}>
      <Ionicons name="cloud-offline-outline" size={24} color={theme.colors.error} />
      <Text style={styles.errorTitle}>Ledger unavailable</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable
        onPress={() => setReloadKey((value) => value + 1)}
        style={({ pressed }) => [
          styles.retryButton,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.retryButtonText}>Try again</Text>
      </Pressable>
    </View>
  ) : visible.length === 0 ? (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={activeTab.icon}
          size={26}
          color={theme.colors.textMuted}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {tab === 'pending'
          ? 'Inbox clear'
          : tab === 'approved'
          ? 'No approved payments yet'
          : 'No rejected payments'}
      </Text>
      <Text style={styles.emptyText}>
        {tab === 'pending'
          ? 'New employee claims will land here for a decision.'
          : tab === 'approved'
          ? 'Approved claims will be kept here as a clean payment record.'
          : 'Rejected claims and the reviewer note will appear here.'}
      </Text>
    </View>
  ) : desktop ? (
    <View style={styles.tableCard}>
      <View style={styles.tableHead}>
        <Text style={[styles.tableHeadText, { flex: 1 }]}>CLAIM</Text>
        <Text style={[styles.tableHeadText, styles.tableEmployee]}>EMPLOYEE</Text>
        <Text style={[styles.tableHeadText, styles.tableAmount]}>AMOUNT</Text>
        <Text style={[styles.tableHeadText, styles.tableStatus]}>STATUS</Text>
        <View style={{ width: 16 }} />
      </View>
      {visible.map((expense, index) => (
        <React.Fragment key={expense.id}>
          {index > 0 ? <View style={styles.rowDivider} /> : null}
          <ClaimRow expense={expense} onPress={() => openClaim(expense)} />
        </React.Fragment>
      ))}
    </View>
  ) : (
    <View style={styles.mobileList}>
      {visible.map((expense) => (
        <ClaimRow
          key={expense.id}
          expense={expense}
          onPress={() => openClaim(expense)}
          mobile
        />
      ))}
    </View>
  );

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.amber]}
              tintColor={theme.colors.amber}
            />
          }
        >
          {headerBlock}
          {metricsBlock}
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionLabel}>PAYMENT DECISIONS</Text>
              <Text style={styles.sectionHint}>
                {visible.length} {visible.length === 1 ? 'claim' : 'claims'} in{' '}
                {activeTab.label.toLowerCase()}
              </Text>
            </View>
            <View style={styles.liveMark}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Synced with employee ledger</Text>
            </View>
          </View>
          {tabsBlock}
          {listBlock}
          <View style={styles.footerNote}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={theme.colors.textMuted}
            />
            <Text style={styles.footerNoteText}>
              Decisions update the employee feed and expense detail immediately.
              Every claim keeps the original receipt and Gemini extraction.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.mobileScroll,
          { paddingBottom: 28 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.amber]}
            tintColor={theme.colors.amber}
          />
        }
      >
        {headerBlock}
        {metricsBlock}
        {tabsBlock}
        {listBlock}
        <View style={styles.footerNote}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={theme.colors.textMuted}
          />
          <Text style={styles.footerNoteText}>
            Decisions update the employee ledger immediately.
          </Text>
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
  desktopPage: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopScroll: {
    width: '100%',
    maxWidth: theme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 56,
  },
  mobileScroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 26,
  },
  mobileHeader: {
    gap: 16,
    marginBottom: 22,
  },
  eyebrow: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: theme.colors.amber,
    marginBottom: 8,
  },
  title: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: theme.colors.textPrimary,
  },
  mobileTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexWrap: 'wrap',
  },
  financeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  financeBadgeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: theme.colors.amberDeep,
  },
  ghostButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  ghostButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 26,
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  metricCardDark: {
    flex: 1.25,
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
    ...theme.shadows.md,
  },
  metricCardSuccess: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.successBorder,
  },
  metricCardError: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.errorBorder,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  metricLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
  },
  metricLabelDark: {
    color: theme.colors.amberOnDark,
  },
  metricAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: theme.colors.textPrimary,
  },
  metricAmountDark: {
    color: theme.colors.white,
  },
  metricFoot: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 14,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  metricFootDark: {
    color: 'rgba(255,255,255,0.5)',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.colors.amber,
  },
  sectionHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  liveMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  liveText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tabActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  tabText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  tabCount: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tabCountText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  tabCountTextActive: {
    color: theme.colors.white,
  },
  tableCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: theme.colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeadText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
  },
  tableEmployee: {
    width: 140,
  },
  tableAmount: {
    width: 96,
    textAlign: 'right',
  },
  tableStatus: {
    width: 112,
  },
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowPressed: {
    backgroundColor: theme.colors.bgSecondary,
  },
  rowClaim: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.colors.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMerchant: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  rowReason: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  rowMetaText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: theme.colors.textMuted,
  },
  rowMetaCategory: {
    flexShrink: 1,
  },
  metaDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
  },
  aiChipText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    color: theme.colors.amberDeep,
  },
  rowEmployee: {
    width: 140,
  },
  rowEmployeeName: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  rowEmployeeMeta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  rowAmount: {
    width: 96,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  rowStatus: {
    width: 112,
    alignItems: 'flex-start',
  },
  rowDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginLeft: 65,
  },
  mobileList: {
    gap: 9,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  mobileRowBody: {
    flex: 1,
    minWidth: 0,
  },
  mobileRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  mobileRowRight: {
    alignItems: 'flex-end',
    gap: 5,
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
  statusPillCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
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
    letterSpacing: 1,
  },
  statusTextCompact: {
    fontSize: 7.5,
    letterSpacing: 0.7,
  },
  loadingBox: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  loadingText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  errorBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    backgroundColor: theme.colors.errorSoft,
  },
  errorTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
  },
  retryButton: {
    marginTop: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: theme.colors.ink,
  },
  retryButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.white,
  },
  emptyBox: {
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  footerNoteText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.textMuted,
  },
});
