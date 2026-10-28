import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { formatINR, formatDate, formatTime } from '../utils/format';
import {
  checkHealth,
  fetchExpenses,
  ExpenseRecord,
  CATEGORY_OPTIONS,
} from '../utils/api';

// ─── Types ─────────────────────────────────────────────────────────────
interface DisplayExpense {
  id: string;
  referenceId: string;
  merchant: string;
  reason: string;
  amountPaise: number;
  category: string;
  iconName: keyof typeof Ionicons.glyphMap;
  date: Date;
  timeFormatted?: string;
  status: string;
}

// Map category to icon
function getCategoryIcon(cat: string): keyof typeof Ionicons.glyphMap {
  const opt = CATEGORY_OPTIONS.find((c) => c.key === cat);
  if (opt) return opt.icon as any;
  if (cat.includes('cab') || cat.includes('transport')) return 'car-outline';
  if (cat.includes('travel')) return 'airplane-outline';
  if (cat.includes('client') || cat.includes('meal')) return 'wine-outline';
  if (cat.includes('team')) return 'restaurant-outline';
  if (cat.includes('comm') || cat.includes('data')) return 'call-outline';
  if (cat.includes('office') || cat.includes('supplies')) return 'briefcase-outline';
  return 'ellipsis-horizontal-outline';
}

// ─── Fallback Seed Data ────────────────────────────────────────────────
function getFallbackExpenses(): DisplayExpense[] {
  const now = new Date();
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const makeDate = (base: Date, h: number, m: number) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };

  return [
    {
      id: 'a1b2c3d4-0001-4000-a000-000000000001',
      referenceId: 'OPE-A7K291',
      merchant: 'Uber India',
      reason: 'Cab to client office for project kickoff meeting',
      amountPaise: 6840,
      category: 'cab_local_transport',
      iconName: 'car-outline',
      date: makeDate(today, 14, 30),
      status: 'Submitted',
    },
    {
      id: 'a1b2c3d4-0002-4000-a000-000000000002',
      referenceId: 'OPE-B3M472',
      merchant: 'Ola Cabs',
      reason: 'Airport pickup — Bengaluru domestic terminal',
      amountPaise: 15200,
      category: 'cab_local_transport',
      iconName: 'car-outline',
      date: makeDate(today, 8, 30),
      status: 'Submitted',
    },
    {
      id: 'a1b2c3d4-0003-4000-a000-000000000003',
      referenceId: 'OPE-C9T583',
      merchant: 'Swiggy',
      reason: 'Team lunch ordered via Swiggy for sprint retro',
      amountPaise: 43500,
      category: 'team_meals',
      iconName: 'restaurant-outline',
      date: makeDate(yesterday, 13, 0),
      status: 'Submitted',
    },
    {
      id: 'a1b2c3d4-0004-4000-a000-000000000004',
      referenceId: 'OPE-D1W694',
      merchant: 'Blue Tokai Coffee',
      reason: 'Coffee meeting with client stakeholders at Koramangala',
      amountPaise: 32000,
      category: 'client_meals_entertainment',
      iconName: 'wine-outline',
      date: makeDate(yesterday, 16, 45),
      status: 'Submitted',
    },
    {
      id: 'a1b2c3d4-0005-4000-a000-000000000005',
      referenceId: 'OPE-E5X705',
      merchant: 'Taj Hotel',
      reason: 'Hotel stay for 2-day client workshop in Mumbai',
      amountPaise: 875000,
      category: 'travel',
      iconName: 'airplane-outline',
      date: makeDate(twoDaysAgo, 9, 0),
      status: 'Submitted',
    },
  ];
}

// ─── Skeleton Loading ──────────────────────────────────────────────────
function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonTextArea}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
      <View style={styles.skeletonAmount} />
    </Animated.View>
  );
}

function SkeletonList() {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

// ─── Server Health Banner ──────────────────────────────────────────────
function ServerBanner({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.serverBanner, { transform: [{ translateY }] }]}>
      <ActivityIndicator size="small" color={theme.colors.amber} />
      <Text style={styles.serverBannerText}>Waking up the server…</Text>
    </Animated.View>
  );
}

// ─── Status Pill ───────────────────────────────────────────────────────
function StatusPill() {
  return (
    <View style={styles.statusPill}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText}>Submitted</Text>
    </View>
  );
}

// ─── Expense Row ───────────────────────────────────────────────────────
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
      style={({ pressed }) => [styles.expenseRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.expenseIconWrap}>
        <Ionicons name={expense.iconName} size={20} color={theme.colors.indigo} />
      </View>
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseMerchant} numberOfLines={1}>
          {expense.merchant}
        </Text>
        <Text style={styles.expenseReason} numberOfLines={1}>
          {expense.reason}
        </Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>
          {formatINR(expense.amountPaise)}
        </Text>
        <Text style={styles.expenseTime}>{expense.timeFormatted || formatTime(expense.date)}</Text>
        <StatusPill />
      </View>
    </Pressable>
  );
}

// ─── Grouped Expense List ──────────────────────────────────────────────
function GroupedExpenseList({
  expenses,
  onSelect,
}: {
  expenses: DisplayExpense[];
  onSelect: (item: DisplayExpense) => void;
}) {
  const groups: { label: string; items: DisplayExpense[] }[] = [];
  const labelMap = new Map<string, DisplayExpense[]>();

  for (const exp of expenses) {
    const label = formatDate(exp.date);
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
    }
    labelMap.get(label)!.push(exp);
  }

  for (const [label, items] of labelMap) {
    groups.push({ label, items });
  }

  return (
    <View>
      {groups.map((group) => (
        <View key={group.label} style={styles.dateGroup}>
          <Text style={styles.dateHeader}>{group.label}</Text>
          {group.items.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onPress={() => onSelect(expense)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Action Card ───────────────────────────────────────────────────────
function ActionCard({
  title,
  subtitle,
  badge,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.actionCardContent}>
        <View style={styles.actionIconWrap}>
          <Ionicons name={icon} size={24} color={theme.colors.white} />
        </View>
        <View style={styles.actionTextWrap}>
          <View style={styles.actionTitleRow}>
            <Text style={styles.actionTitle}>{title}</Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>{badge}</Text>
            </View>
          </View>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color="rgba(255,255,255,0.5)"
        />
      </View>
    </Pressable>
  );
}

// ─── Home Screen ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const containerMaxWidth = width > 460 ? 420 : width;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expenses, setExpenses] = useState<DisplayExpense[]>([]);
  const [serverBanner, setServerBanner] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Map backend API records to display items
  const mapRecord = (r: ExpenseRecord): DisplayExpense => {
    let dateObj: Date;
    if (r.expense_date) {
      const parts = r.expense_date.split('-');
      if (parts.length === 3) {
        dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      } else {
        dateObj = new Date(r.expense_date);
      }
    } else {
      dateObj = new Date(r.created_at);
    }

    return {
      id: r.id,
      referenceId: r.reference_id,
      merchant: r.merchant || 'Expense',
      reason: r.reason,
      amountPaise: r.amount_minor,
      category: r.category,
      iconName: getCategoryIcon(r.category),
      date: dateObj,
      timeFormatted: r.created_at ? formatTime(new Date(r.created_at)) : formatTime(dateObj),
      status: 'Submitted',
    };
  };

  useEffect(() => {
    // Health check with 3s delay indicator
    let bannerTimer: ReturnType<typeof setTimeout> | null = null;
    let dismissed = false;

    bannerTimer = setTimeout(() => {
      if (!dismissed) setServerBanner(true);
    }, 3000);

    checkHealth()
      .then(() => {
        dismissed = true;
        if (bannerTimer) clearTimeout(bannerTimer);
        setServerBanner(false);
      })
      .catch(() => {});

    // Fetch initial expenses
    fetchExpenses(null, 15)
      .then((data) => {
        dismissed = true;
        setServerBanner(false);
        if (data.items && data.items.length > 0) {
          setExpenses(data.items.map(mapRecord));
          setNextCursor(data.next_cursor);
          setHasMore(data.has_more);
          setTotalCount(data.total_count);
        } else {
          // If empty, show fallback seed expenses
          const fallback = getFallbackExpenses();
          setExpenses(fallback);
          setTotalCount(fallback.length);
        }
        setLoading(false);
      })
      .catch(() => {
        // Backend offline or error -> use fallback seed data
        const fallback = getFallbackExpenses();
        setExpenses(fallback);
        setTotalCount(fallback.length);
        setLoading(false);
      });

    return () => {
      if (bannerTimer) clearTimeout(bannerTimer);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchExpenses(null, 15);
      if (data.items && data.items.length > 0) {
        setExpenses(data.items.map(mapRecord));
        setNextCursor(data.next_cursor);
        setHasMore(data.has_more);
        setTotalCount(data.total_count);
      }
    } catch {
      // Keep existing data on error
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchExpenses(nextCursor, 15);
      if (data.items) {
        setExpenses((prev) => [...prev, ...data.items.map(mapRecord)]);
        setNextCursor(data.next_cursor);
        setHasMore(data.has_more);
      }
    } catch {
      // silently fail load more
    } finally {
      setLoadingMore(false);
    }
  };

  const displayCount = totalCount || expenses.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ServerBanner visible={serverBanner} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.indigo]}
            tintColor={theme.colors.indigo}
          />
        }
      >
        <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
          {/* ── Header ────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                onPress={() => router.replace('/')}
                hitSlop={12}
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
                accessibilityLabel="Back to welcome"
              >
                <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
              </Pressable>
              <View>
                <Text style={styles.headerLabel}>DEXTER CAPITAL</Text>
                <Text style={styles.headerTitle}>Expenses</Text>
              </View>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>PS</Text>
            </View>
          </View>

          {/* ── Summary Bar (no money totals, per spec) ───── */}
          <View style={styles.summaryBar}>
            <Text style={styles.summaryLeft}>
              {displayCount} expenses submitted
            </Text>
            <Text style={styles.summaryRight}>This month</Text>
          </View>

          {/* ── Primary Action Cards ──────────────────────── */}
          <View style={styles.actionCards}>
            <ActionCard
              title="Snap a bill"
              subtitle="Auto-fills amount, date & merchant"
              badge="AI-OCR"
              icon="camera-outline"
              onPress={() => router.push('/snap')}
            />
            <ActionCard
              title="No bill? UPI & others"
              subtitle="Screenshot or type it, we fill the rest"
              badge="AI-FILL"
              icon="phone-portrait-outline"
              onPress={() => router.push('/no-bill')}
            />
          </View>

          {/* ── Recent Activity ───────────────────────────── */}
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>

          {loading ? (
            <SkeletonList />
          ) : expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="receipt-outline"
                size={64}
                color={theme.colors.border}
              />
              <Text style={styles.emptyTitle}>No expenses yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button to log your first expense
              </Text>
            </View>
          ) : (
            <>
              <GroupedExpenseList
                expenses={expenses}
                onSelect={(exp) =>
                  router.push({
                    pathname: '/expense/[id]',
                    params: { id: exp.referenceId || exp.id },
                  })
                }
              />

              {hasMore && (
                <Pressable
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  style={({ pressed }) => [
                    styles.loadMoreBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={theme.colors.indigo} />
                  ) : (
                    <>
                      <Text style={styles.loadMoreText}>Load more expenses</Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={theme.colors.indigo}
                      />
                    </>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Floating Action Button (+) ──────────────────── */}
      <Pressable
        onPress={() => router.push('/snap')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: 24 + insets.bottom },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
        accessibilityLabel="Log new expense"
      >
        <Ionicons name="add" size={28} color={theme.colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 110,
  },
  container: {
    width: '100%',
    paddingHorizontal: theme.spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    marginLeft: -theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
    marginBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.displayMedium,
    color: theme.colors.textPrimary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: '700',
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  summaryLeft: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  summaryRight: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },

  // Action Cards
  actionCards: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  actionCard: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.lg,
    ...theme.shadows.md,
    minHeight: 76,
    justifyContent: 'center',
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  actionTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.white,
  },
  actionSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: 'rgba(255,255,255,0.65)',
  },
  aiBadge: {
    backgroundColor: theme.colors.indigo,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  aiBadgeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },

  // Section Label
  sectionLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
    marginBottom: theme.spacing.lg,
  },

  // Date Groups
  dateGroup: {
    marginBottom: theme.spacing.lg,
  },
  dateHeader: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    paddingLeft: theme.spacing.xs,
  },

  // Expense Row
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    minHeight: 72,
  },
  expenseIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.indigoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  expenseInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  expenseMerchant: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  expenseReason: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  expenseTime: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },

  // Status Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.success,
  },

  // Pagination
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  loadMoreText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.indigo,
    fontWeight: '600',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },

  // Skeleton
  skeletonContainer: {
    gap: theme.spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSecondary,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.border,
    marginRight: theme.spacing.md,
  },
  skeletonTextArea: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.border,
    width: '80%',
  },
  skeletonAmount: {
    width: 60,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl * 2,
  },
  emptyTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingMedium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Server Banner
  serverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.navy,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  serverBannerText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.white,
  },
});
