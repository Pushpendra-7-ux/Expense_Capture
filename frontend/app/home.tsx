import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useAppRole } from '../components/RoleContext';
import { formatDate, formatINR, formatTime } from '../utils/format';
import {
  CATEGORY_FILTERS,
  checkHealth,
  ExpenseRecord,
  fetchExpenses,
  getCategoryIcon,
  getCategoryLabel,
  ReviewStatus,
} from '../utils/api';

interface DisplayExpense {
  id: string;
  referenceId: string;
  merchant: string;
  reason: string;
  amountPaise: number;
  category: string;
  iconName: keyof typeof Ionicons.glyphMap;
  date: Date;
  createdAt: Date;
  status: ReviewStatus;
}

function fallbackDate(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Graceful demo fallback if the API is unreachable. Matches the seeded ledger
// so navigation still works while the backend cold-starts.
const FALLBACK_EXPENSES: DisplayExpense[] = [
  {
    id: 'a1b2c3d4-0001-4000-a000-000000000001',
    referenceId: 'OPE-A7K291',
    merchant: 'Uber',
    reason: 'Airport Transfer to Terminal 2',
    amountPaise: 6840,
    category: 'cab_local_transport',
    iconName: 'car-outline',
    date: fallbackDate(0, 14, 15),
    createdAt: fallbackDate(0, 14, 15),
    status: 'approved',
  },
  {
    id: 'a1b2c3d4-0002-4000-a000-000000000002',
    referenceId: 'OPE-B3M472',
    merchant: 'The Grill House',
    reason: 'Client Dinner (Founders Fund)',
    amountPaise: 34000,
    category: 'client_meals_entertainment',
    iconName: 'restaurant-outline',
    date: fallbackDate(1, 20, 10),
    createdAt: fallbackDate(1, 20, 10),
    status: 'under_review',
  },
  {
    id: 'a1b2c3d4-0003-4000-a000-000000000003',
    referenceId: 'OPE-D1W694',
    merchant: 'Blue Tokai Coffee',
    reason: 'Discussion with Series B team',
    amountPaise: 1850,
    category: 'client_meals_entertainment',
    iconName: 'cafe-outline',
    date: fallbackDate(3, 11, 20),
    createdAt: fallbackDate(3, 11, 20),
    status: 'approved',
  },
  {
    id: 'a1b2c3d4-0004-4000-a000-000000000004',
    referenceId: 'OPE-K8L260',
    merchant: 'IndiGo Airlines',
    reason: 'Return flight BOM-DEL for investor symposium',
    amountPaise: 245000,
    category: 'travel',
    iconName: 'airplane-outline',
    date: fallbackDate(5, 9, 45),
    createdAt: fallbackDate(5, 9, 45),
    status: 'approved',
  },
  {
    id: 'a1b2c3d4-0005-4000-a000-000000000005',
    referenceId: 'OPE-E5X705',
    merchant: 'Taj Hotel',
    reason: 'Airport transit hotel for client workshop',
    amountPaise: 45000,
    category: 'travel',
    iconName: 'business-outline',
    date: fallbackDate(8, 16, 30),
    createdAt: fallbackDate(8, 16, 30),
    status: 'approved',
  },
  {
    id: 'a1b2c3d4-0006-4000-a000-000000000006',
    referenceId: 'OPE-G2Z927',
    merchant: 'Amazon Business',
    reason: 'USB-C hub and notebook for desk setup',
    amountPaise: 8560,
    category: 'office_supplies',
    iconName: 'briefcase-outline',
    date: fallbackDate(12, 14, 10),
    createdAt: fallbackDate(12, 14, 10),
    status: 'under_review',
  },
  {
    id: 'a1b2c3d4-0007-4000-a000-000000000007',
    referenceId: 'OPE-J4K159',
    merchant: 'Chai Point',
    reason: 'Team chai after late client call',
    amountPaise: 800,
    category: 'team_meals',
    iconName: 'cafe-outline',
    date: fallbackDate(15, 17, 20),
    createdAt: fallbackDate(15, 17, 20),
    status: 'approved',
  },
];

function iconForCategory(category: string): keyof typeof Ionicons.glyphMap {
  if (category === 'client_meals_entertainment') return 'wine-outline';
  if (category === 'team_meals') return 'restaurant-outline';
  return getCategoryIcon(category) as keyof typeof Ionicons.glyphMap;
}

function parseExpenseDate(record: ExpenseRecord): Date {
  if (record.created_at) return new Date(record.created_at);
  if (record.expense_date) {
    const [y, m, d] = record.expense_date.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date();
}

function mapRecord(record: ExpenseRecord): DisplayExpense {
  return {
    id: record.id,
    referenceId: record.reference_id,
    merchant: record.merchant || 'Expense',
    reason: record.reason,
    amountPaise: record.amount_minor,
    category: record.category,
    iconName: iconForCategory(record.category),
    date: parseExpenseDate(record),
    createdAt: new Date(record.created_at || record.expense_date),
    status: record.review_status || 'submitted',
  };
}

function feedDateLabel(item: DisplayExpense): string {
  const label = formatDate(item.date);
  if (label === 'Today') return `Today, ${formatTime(item.createdAt)}`;
  return label;
}

function statusMeta(status: ReviewStatus) {
  if (status === 'approved') {
    return {
      label: 'Approved',
      color: theme.colors.success,
      background: theme.colors.successSoft,
      border: theme.colors.successBorder,
    };
  }
  if (status === 'under_review') {
    return {
      label: 'Under Review',
      color: theme.colors.amber,
      background: theme.colors.amberSoft,
      border: theme.colors.amberBorder,
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Rejected',
      color: theme.colors.error,
      background: theme.colors.errorSoft,
      border: theme.colors.errorBorder,
    };
  }
  return {
    label: 'Submitted',
    color: '#52637A',
    background: '#F1F4F9',
    border: '#E4E9F1',
  };
}

function StatusPill({ status }: { status: ReviewStatus }) {
  const meta = statusMeta(status);
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: meta.background, borderColor: meta.border },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '58%' }]} />
      </View>
      <View style={styles.skeletonAmount} />
    </Animated.View>
  );
}

function ServerBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.serverBanner}>
      <ActivityIndicator size="small" color={theme.colors.amberOnDark} />
      <Text style={styles.serverBannerText}>Waking up the ledger…</Text>
    </View>
  );
}

function ExpenseRow({
  expense,
  onPress,
}: {
  expense: DisplayExpense;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.expenseCard, pressed && { opacity: 0.72 }]}
      accessibilityRole="button"
      accessibilityLabel={`${expense.merchant}, ${formatINR(expense.amountPaise)}`}
    >
      <View style={styles.expenseIconWrap}>
        <Ionicons
          name={expense.iconName}
          size={21}
          color={theme.colors.iconInk}
        />
      </View>

      <View style={styles.expenseBody}>
        <Text style={styles.expenseMerchant} numberOfLines={1}>
          {expense.merchant}
        </Text>
        <Text style={styles.expenseReason} numberOfLines={1}>
          {expense.reason}
        </Text>
        <Text style={styles.expenseDate}>{feedDateLabel(expense)}</Text>
      </View>

      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{formatINR(expense.amountPaise)}</Text>
        <StatusPill status={expense.status} />
      </View>
    </Pressable>
  );
}

function SnapCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.darkCard, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel="Snap a bill with AI"
    >
      <View style={styles.darkIconWrap}>
        <Ionicons name="camera-outline" size={24} color={theme.colors.amberOnDark} />
      </View>
      <View style={styles.darkCardBody}>
        <View style={styles.darkCardTitleRow}>
          <Text style={styles.darkCardTitle}>Snap a Bill</Text>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI-OCR</Text>
          </View>
        </View>
        <Text style={styles.darkCardSubtitle}>
          Instant AI auto-fill • ~15s turnaround
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.62)" />
    </Pressable>
  );
}

function UpiCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.darkCard, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel="Add a non-bill UPI payment"
    >
      <View style={[styles.darkIconWrap, styles.upiIconWrap]}>
        <Ionicons name="card-outline" size={23} color={theme.colors.amberOnDark} />
      </View>
      <View style={styles.darkCardBody}>
        <View style={styles.darkCardTitleRow}>
          <Text style={styles.darkCardTitle}>Non-Bill / UPI Payment</Text>
          <View style={[styles.aiBadge, styles.upiBadge]}>
            <Text style={styles.aiBadgeText}>UPI CLAIM</Text>
          </View>
        </View>
      </View>
      <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.62)" />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;
  const { setRole } = useAppRole();

  useEffect(() => {
    setRole('employee');
  }, [setRole]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expenses, setExpenses] = useState<DisplayExpense[]>([]);
  const [serverBanner, setServerBanner] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filterKey, setFilterKey] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFocus = useRef(true);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const reloadLedger = useCallback(async () => {
    const data = await fetchExpenses(null, 30);
    setExpenses(data.items.map(mapRecord));
    setNextCursor(data.next_cursor);
    setHasMore(data.has_more);
  }, []);

  // A claim filed from Quick Capture or No-Bill must appear in Recent Activity
  // as soon as the employee returns to the feed.
  useFocusEffect(
    useCallback(() => {
      if (initialFocus.current) {
        initialFocus.current = false;
        return;
      }
      reloadLedger().catch(() => {});
    }, [reloadLedger])
  );

  useEffect(() => {
    let cancelled = false;
    const bannerTimer = setTimeout(() => {
      if (!cancelled) setServerBanner(true);
    }, 3000);

    checkHealth()
      .then(() => {
        if (cancelled) return;
        clearTimeout(bannerTimer);
        setServerBanner(false);
      })
      .catch(() => {});

    fetchExpenses(null, 30)
      .then((data) => {
        if (cancelled) return;
        setExpenses(data.items.map(mapRecord));
        setNextCursor(data.next_cursor);
        setHasMore(data.has_more);
      })
      .catch(() => {
        if (cancelled) return;
        setExpenses(FALLBACK_EXPENSES);
      })
      .finally(() => {
        clearTimeout(bannerTimer);
        setServerBanner(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(bannerTimer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadLedger();
    } catch {
      showToast('Could not reach the ledger. Showing saved view.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchExpenses(nextCursor, 30);
      setExpenses((prev) => [...prev, ...data.items.map(mapRecord)]);
      setNextCursor(data.next_cursor);
      setHasMore(data.has_more);
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFilter =
    CATEGORY_FILTERS.find((f) => f.key === filterKey) || CATEGORY_FILTERS[0];
  const filtered = activeFilter.categories
    ? expenses.filter((e) => activeFilter.categories!.includes(e.category as any))
    : expenses;

  const visible = expanded ? filtered : filtered.slice(0, 3);

  const newest = expenses[0]?.date || new Date();
  const periodItems = expenses.filter(
    (e) =>
      e.date.getFullYear() === newest.getFullYear() &&
      e.date.getMonth() === newest.getMonth()
  );
  const periodTotal = periodItems.reduce((sum, e) => sum + e.amountPaise, 0);
  const approvedCount = periodItems.filter((e) => e.status === 'approved').length;
  const reviewCount = periodItems.filter(
    (e) => e.status === 'under_review' || e.status === 'submitted'
  ).length;
  const desktopVisible = expanded ? filtered : filtered.slice(0, 6);
  const periodLabel = newest
    .toLocaleDateString('en-US', { month: 'long' })
    .toUpperCase();

  const toggleViewAll = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (hasMore) await handleLoadMore();
  };

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        <ServerBanner visible={serverBanner} />

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
          <View style={styles.desktopHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.desktopEyebrowRow}>
                <Text style={styles.desktopEyebrow}>OCTOBER LEDGER</Text>
                <View style={styles.desktopEyebrowDot} />
                <Text style={styles.desktopEyebrowMuted}>
                  Dexter Capital · OPE
                </Text>
              </View>
              <Text style={styles.desktopTitle}>Expenses Feed</Text>
              <Text style={styles.desktopSubtitle}>
                Every bill, payment proof, and claim in one ledger.
              </Text>
            </View>

            <View style={styles.desktopHeaderActions}>
              <Pressable
                onPress={() => router.push('/no-bill')}
                style={({ pressed }) => [
                  styles.desktopGhostButton,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={16}
                  color={theme.colors.textPrimary}
                />
                <Text style={styles.desktopGhostButtonText}>UPI claim</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/snap')}
                style={({ pressed }) => [
                  styles.desktopPrimaryButton,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Ionicons name="add" size={18} color={theme.colors.white} />
                <Text style={styles.desktopPrimaryButtonText}>New expense</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.desktopStats}>
            <View style={[styles.desktopStatCard, styles.desktopStatCardHero]}>
              <Text style={styles.desktopStatLabel}>{periodLabel} CLAIMS</Text>
              <Text style={styles.desktopStatAmount}>
                {formatINR(periodTotal)}
              </Text>
              <Text style={styles.desktopStatFoot}>
                {periodItems.length} claims submitted this month
              </Text>
            </View>
            <View style={styles.desktopStatCard}>
              <Text style={styles.desktopStatLabel}>APPROVED</Text>
              <Text style={styles.desktopStatValue}>{approvedCount}</Text>
              <Text style={styles.desktopStatFoot}>Ready for reimbursement</Text>
            </View>
            <View style={styles.desktopStatCard}>
              <Text style={styles.desktopStatLabel}>IN REVIEW</Text>
              <Text style={styles.desktopStatValue}>{reviewCount}</Text>
              <Text style={styles.desktopStatFoot}>Waiting on Finance</Text>
            </View>
            <View style={styles.desktopStatCard}>
              <Text style={styles.desktopStatLabel}>AI CAPTURE</Text>
              <Text style={styles.desktopStatValue}>~30s</Text>
              <Text style={styles.desktopStatFoot}>Bill or UPI proof to draft</Text>
            </View>
          </View>

          <View style={styles.desktopGrid}>
            <View style={styles.desktopFeedCol}>
              <View style={styles.desktopFeedTop}>
                <View>
                  <Text style={styles.desktopSectionLabel}>RECENT ACTIVITY</Text>
                  <Text style={styles.desktopSectionHint}>
                    {filtered.length} claims in this view
                  </Text>
                </View>
                <View style={styles.desktopFeedTopRight}>
                  <View style={styles.desktopLiveDot} />
                  <Text style={styles.desktopLiveText}>Synced with Finance</Text>
                </View>
              </View>

              <View style={styles.desktopFilters}>
                {CATEGORY_FILTERS.map((filter) => {
                  const active = filter.key === filterKey;
                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => {
                        setFilterKey(filter.key);
                        setExpanded(false);
                      }}
                      style={({ pressed }) => [
                        styles.filterChip,
                        active && styles.filterChipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {loading ? (
                <View style={styles.list}>
                  {[1, 2, 3, 4].map((i) => (
                    <SkeletonRow key={i} />
                  ))}
                </View>
              ) : filtered.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={30}
                      color={theme.colors.textMuted}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>Nothing in this bucket</Text>
                  <Text style={styles.emptyText}>
                    Try another category or snap your first bill.
                  </Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {desktopVisible.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onPress={() =>
                        router.push({
                          pathname: '/expense/[id]',
                          params: { id: expense.referenceId || expense.id },
                        })
                      }
                    />
                  ))}
                </View>
              )}

              {filtered.length > 6 ? (
                <Pressable
                  onPress={toggleViewAll}
                  style={({ pressed }) => [
                    styles.viewAllButton,
                    styles.desktopViewAll,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.viewAllText}>
                    {expanded ? 'SHOW LESS' : 'VIEW ALL TRANSACTIONS'}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>
              ) : null}

              {expanded && hasMore ? (
                <Pressable
                  onPress={handleLoadMore}
                  style={styles.loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={theme.colors.amber} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load older claims</Text>
                  )}
                </Pressable>
              ) : null}
            </View>

            <View style={styles.desktopRail}>
              <View style={styles.desktopRailHeader}>
                <Text style={styles.desktopSectionLabel}>QUICK CAPTURE</Text>
                <Text style={styles.desktopSectionHint}>Two ways to file</Text>
              </View>

              <SnapCard onPress={() => router.push('/snap')} />
              <View style={{ height: 10 }} />
              <UpiCard onPress={() => router.push('/no-bill')} />

              <View style={styles.desktopRailCard}>
                <View style={styles.desktopRailCardTop}>
                  <View style={styles.desktopRailIcon}>
                    <Ionicons
                      name="sparkles-outline"
                      size={17}
                      color={theme.colors.amberDeep}
                    />
                  </View>
                  <Text style={styles.desktopRailTitle}>How capture works</Text>
                </View>
                <View style={styles.desktopSteps}>
                  {[
                    'Attach a bill, UPI screenshot, or PDF',
                    'Gemini reads amount, date, payee, and purpose',
                    'Check the draft and submit to the ledger',
                  ].map((step, index) => (
                    <View key={step} style={styles.desktopStepRow}>
                      <View style={styles.desktopStepNumber}>
                        <Text style={styles.desktopStepNumberText}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.desktopStepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.desktopRailFoot}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.desktopRailFootText}>
                  Encrypted in transit · Synced with Finance
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {toast ? (
          <View style={styles.desktopToast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ServerBanner visible={serverBanner} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 122 + insets.bottom },
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
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.wordmarkRow}>
                <Text style={styles.wordmark}>DEXTER CAPITAL</Text>
                <View style={styles.wordmarkDot} />
                <View style={styles.wordmarkDot} />
              </View>
              <Text style={styles.pageTitle}>Expenses Feed</Text>
            </View>
            <Pressable
              onPress={() => showToast('Signed in as Pushpendra Suryawanshi')}
              style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.75 }]}
              accessibilityLabel="Profile"
            >
              <Text style={styles.avatarText}>PS</Text>
            </Pressable>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.periodLabel}>{periodLabel} CLAIMS</Text>
            <Text style={styles.periodAmount}>{formatINR(periodTotal)}</Text>
            <View style={styles.claimsRow}>
              <Text style={styles.claimsText}>
                {periodItems.length} claims submitted
              </Text>
              <View style={styles.claimsDot} />
            </View>
          </View>

          {/* Primary actions */}
          <View style={styles.actionStack}>
            <SnapCard onPress={() => router.push('/snap')} />
          </View>

          {/* Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {CATEGORY_FILTERS.map((filter) => {
              const active = filter.key === filterKey;
              return (
                <Pressable
                  key={filter.key}
                  onPress={() => {
                    setFilterKey(filter.key);
                    setExpanded(false);
                  }}
                  style={({ pressed }) => [
                    styles.filterChip,
                    active && styles.filterChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Recent activity */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            <Text style={styles.visibleLabel}>
              {visible.length} OF {filtered.length} VISIBLE
            </Text>
          </View>

          {loading ? (
            <View style={styles.list}>
              {[1, 2, 3].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="receipt-outline"
                  size={30}
                  color={theme.colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>Nothing in this bucket</Text>
              <Text style={styles.emptyText}>
                Try another category or snap your first bill.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visible.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onPress={() =>
                    router.push({
                      pathname: '/expense/[id]',
                      params: { id: expense.referenceId || expense.id },
                    })
                  }
                />
              ))}

              {filtered.length > 3 && (
                <Pressable
                  onPress={toggleViewAll}
                  style={({ pressed }) => [
                    styles.viewAllButton,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.viewAllText}>
                    {expanded ? 'SHOW LESS' : 'VIEW ALL TRANSACTIONS'}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>
              )}
            </View>
          )}

          {expanded && hasMore && (
            <Pressable
              onPress={handleLoadMore}
              style={styles.loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={theme.colors.amber} />
              ) : (
                <Text style={styles.loadMoreText}>Load older claims</Text>
              )}
            </Pressable>
          )}

          <View style={styles.upiSection}>
            <UpiCard onPress={() => router.push('/no-bill')} />
          </View>
        </View>
      </ScrollView>

      {/* Bottom navigation */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.navItem} onPress={() => {}}>
          <Ionicons name="receipt-outline" size={21} color={theme.colors.ink} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Expenses</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => showToast('Analytics is outside this prototype.')}
        >
          <Ionicons name="stats-chart-outline" size={21} color={theme.colors.textMuted} />
          <Text style={styles.navLabel}>Analytics</Text>
        </Pressable>
      </View>

      {/* Floating add button */}
      <View
        style={[styles.fabWrap, { bottom: 30 + Math.max(insets.bottom, 10) }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.push('/snap')}
          style={({ pressed }) => [
            styles.fab,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
          accessibilityLabel="Log new expense"
        >
          <Ionicons name="add" size={28} color={theme.colors.white} />
        </Pressable>
      </View>

      {toast && (
        <View style={[styles.toast, { bottom: 108 + insets.bottom }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollContent: {
    paddingTop: theme.spacing.sm,
  },
  container: {
    width: '100%',
    paddingHorizontal: theme.layout.gutter,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  wordmark: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
    color: '#344054',
  },
  wordmarkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.amber,
    marginLeft: 4,
  },
  pageTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingLarge,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.colors.white,
  },

  // Summary
  summary: {
    marginBottom: theme.spacing.xl,
  },
  periodLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.amber,
    marginBottom: 10,
  },
  periodAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: theme.colors.textPrimary,
  },
  claimsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  claimsText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  claimsDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.amber,
    marginLeft: 7,
  },

  // Action cards
  actionStack: {
    marginBottom: theme.spacing.lg,
  },
  darkCard: {
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: '#0A0C10',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  darkIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(232, 201, 142, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(232, 201, 142, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  upiIconWrap: {
    backgroundColor: 'rgba(232, 201, 142, 0.09)',
  },
  darkCardBody: {
    flex: 1,
    marginRight: 12,
  },
  darkCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  darkCardTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.white,
  },
  darkCardSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: 'rgba(255,255,255,0.56)',
  },
  aiBadge: {
    backgroundColor: 'rgba(232, 201, 142, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(232, 201, 142, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  upiBadge: {
    backgroundColor: 'rgba(232, 201, 142, 0.1)',
  },
  aiBadgeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.75,
    color: theme.colors.amberOnDark,
  },

  // Filters
  filterRow: {
    gap: 8,
    paddingRight: 8,
    paddingBottom: theme.spacing.xl,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: theme.colors.ink,
  },
  filterChipText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.65,
    color: '#475467',
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },

  // Section heading
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.amber,
  },
  visibleLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.55,
    color: theme.colors.textMuted,
  },

  // List
  list: {
    gap: 10,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 82,
    ...theme.shadows.sm,
  },
  expenseIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  expenseBody: {
    flex: 1,
    marginRight: 8,
  },
  expenseMerchant: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  expenseReason: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  expenseDate: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontSize: 11.5,
    color: theme.colors.textMuted,
  },
  expenseRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  expenseAmount: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    fontSize: 16.5,
    color: theme.colors.textPrimary,
    marginBottom: 7,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
  },

  // View all / pagination
  viewAllButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  viewAllText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.85,
    color: theme.colors.textPrimary,
  },
  loadMore: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.amber,
    fontWeight: '600',
  },

  upiSection: {
    marginTop: theme.spacing.xl,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },

  // Bottom nav
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 58,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    minHeight: 48,
  },
  navLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  navLabelActive: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: theme.colors.white,
    ...theme.shadows.lg,
  },

  // Skeleton
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 14,
    minHeight: 82,
  },
  skeletonIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.bgSecondary,
    marginRight: 13,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 11,
    width: '74%',
    borderRadius: 6,
    backgroundColor: theme.colors.bgSecondary,
  },
  skeletonAmount: {
    width: 64,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.bgSecondary,
  },

  // Server banner
  serverBanner: {
    backgroundColor: theme.colors.ink,
    paddingVertical: 7,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  serverBannerText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.white,
  },

  // Toast
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: theme.colors.ink,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...theme.shadows.lg,
  },
  toastText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    textAlign: 'center',
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
    paddingTop: 32,
    paddingBottom: 56,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 28,
  },
  desktopEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },
  desktopEyebrow: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: theme.colors.amber,
  },
  desktopEyebrowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.amberBorder,
  },
  desktopEyebrowMuted: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  desktopTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: theme.colors.textPrimary,
  },
  desktopSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginTop: 7,
  },
  desktopHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  desktopGhostButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  desktopGhostButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  desktopPrimaryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: theme.colors.ink,
    ...theme.shadows.md,
  },
  desktopPrimaryButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  desktopStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 26,
  },
  desktopStatCard: {
    flex: 1,
    minWidth: 190,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  desktopStatCardHero: {
    flex: 1.35,
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  desktopStatLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.25,
    color: theme.colors.amber,
    marginBottom: 9,
  },
  desktopStatAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.white,
  },
  desktopStatValue: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: theme.colors.textPrimary,
  },
  desktopStatFoot: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 14,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  desktopFeedCol: {
    flex: 1,
    minWidth: 0,
  },
  desktopFeedTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  desktopSectionLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.colors.amber,
  },
  desktopSectionHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  desktopFeedTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  desktopLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  desktopLiveText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  desktopFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  desktopViewAll: {
    marginTop: 10,
  },
  desktopRail: {
    width: 324,
    flexShrink: 0,
  },
  desktopRailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  desktopRailCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  desktopRailCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 13,
  },
  desktopRailIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: theme.colors.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopRailTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  desktopSteps: {
    gap: 10,
  },
  desktopStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  desktopStepNumber: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  desktopStepNumberText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  desktopStepText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  desktopRailFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  desktopRailFootText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: theme.colors.textMuted,
  },
  desktopToast: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    width: 360,
    backgroundColor: theme.colors.ink,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...theme.shadows.lg,
  },
});
