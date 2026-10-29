import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useAppRole } from './RoleContext';

interface NavItem {
  key: string;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  tab?: string;
}

const EMPLOYEE_NAV: NavItem[] = [
  {
    key: 'expenses',
    label: 'Expenses',
    hint: 'Feed & claims',
    icon: 'receipt-outline',
    href: '/home',
  },
  {
    key: 'capture',
    label: 'Quick capture',
    hint: 'Bill or invoice',
    icon: 'camera-outline',
    href: '/snap',
  },
  {
    key: 'no-bill',
    label: 'No-bill claim',
    hint: 'UPI & payment proof',
    icon: 'phone-portrait-outline',
    href: '/no-bill',
  },
];

const FINANCE_NAV: NavItem[] = [
  {
    key: 'queue',
    label: 'Claims inbox',
    hint: 'Awaiting a decision',
    icon: 'file-tray-full-outline',
    href: '/finance',
    tab: 'pending',
  },
  {
    key: 'approved',
    label: 'Approved payments',
    hint: 'Cleared by Finance',
    icon: 'checkmark-circle-outline',
    href: '/finance',
    tab: 'approved',
  },
  {
    key: 'rejected',
    label: 'Rejected payments',
    hint: 'Returned to employee',
    icon: 'close-circle-outline',
    href: '/finance',
    tab: 'rejected',
  },
];

export function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ tab?: string }>();
  const { role, setRole } = useAppRole();

  const financeWorkspace = role === 'finance';
  const navItems = financeWorkspace ? FINANCE_NAV : EMPLOYEE_NAV;
  const currentTab = params.tab || 'pending';

  const isActive = (item: NavItem) => {
    if (financeWorkspace) {
      if (item.key === 'queue') {
        return (
          pathname.startsWith('/finance') &&
          (currentTab === 'pending' || pathname !== '/finance')
        );
      }
      return pathname === '/finance' && currentTab === item.tab;
    }
    if (item.href === '/home') {
      return (
        pathname === '/home' ||
        pathname === '/' ||
        pathname.startsWith('/expense')
      );
    }
    return pathname === item.href;
  };

  const switchRole = (next: 'employee' | 'finance') => {
    if (next === role) return;
    setRole(next);
    router.replace(next === 'finance' ? '/finance' : '/home');
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>D</Text>
          <View style={styles.brandDot} />
        </View>
        <View>
          <Text style={styles.brandName}>DEXTER CAPITAL</Text>
          <Text style={styles.brandSub}>OPE INSTANT LEDGER</Text>
        </View>
      </View>

      <View style={styles.roleSwitch}>
        <Pressable
          onPress={() => switchRole('employee')}
          style={({ pressed }) => [
            styles.roleOption,
            !financeWorkspace && styles.roleOptionActive,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Switch to employee workspace"
        >
          <Ionicons
            name="person-outline"
            size={12}
            color={
              !financeWorkspace ? theme.colors.textPrimary : theme.colors.textMuted
            }
          />
          <Text
            style={[
              styles.roleOptionText,
              !financeWorkspace && styles.roleOptionTextActive,
            ]}
          >
            Employee
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchRole('finance')}
          style={({ pressed }) => [
            styles.roleOption,
            financeWorkspace && styles.roleOptionActive,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Switch to finance workspace"
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={12}
            color={
              financeWorkspace ? theme.colors.textPrimary : theme.colors.textMuted
            }
          />
          <Text
            style={[
              styles.roleOptionText,
              financeWorkspace && styles.roleOptionTextActive,
            ]}
          >
            Finance
          </Text>
        </Pressable>
      </View>

      {financeWorkspace ? (
        <View style={styles.financeCard}>
          <View style={styles.financeCardTop}>
            <View style={styles.financeIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={theme.colors.amberOnDark}
              />
            </View>
            <Text style={styles.financeLabel}>FINANCE CONSOLE</Text>
          </View>
          <Text style={styles.financeTitle}>Review and clear claims</Text>
          <Text style={styles.financeText}>
            Approve or reject employee payments. Decisions sync to the ledger
            instantly.
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push('/snap')}
          style={({ pressed }) => [
            styles.newButton,
            pressed && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Log a new expense"
        >
          <View style={styles.newButtonIcon}>
            <Ionicons name="add" size={19} color={theme.colors.amberOnDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newButtonTitle}>New expense</Text>
            <Text style={styles.newButtonSub}>~30 second capture</Text>
          </View>
          <Ionicons
            name="arrow-forward"
            size={17}
            color="rgba(255,255,255,0.45)"
          />
        </Pressable>
      )}

      <Text style={styles.navSectionLabel}>
        {financeWorkspace ? 'FINANCE' : 'WORKSPACE'}
      </Text>

      <View style={styles.navList}>
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Pressable
              key={item.key}
              onPress={() =>
                router.push(
                  item.tab
                    ? { pathname: item.href, params: { tab: item.tab } }
                    : item.href
                )
              }
              style={({ pressed }) => [
                styles.navItem,
                active && styles.navItemActive,
                pressed && !active && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              {active ? <View style={styles.activeBar} /> : null}
              <View style={[styles.navIcon, active && styles.navIconActive]}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? theme.colors.ink : theme.colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.navText, active && styles.navTextActive]}>
                  {item.label}
                </Text>
                <Text style={styles.navHint}>{item.hint}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={active ? theme.colors.amberDeep : theme.colors.borderStrong}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <View style={styles.sideCard}>
        <View style={styles.sideCardIcon}>
          <Ionicons
            name="sparkles-outline"
            size={15}
            color={theme.colors.amberDeep}
          />
        </View>
        <Text style={styles.sideCardTitle}>
          {financeWorkspace ? 'Gemini claim detail' : 'AI claim reader'}
        </Text>
        <Text style={styles.sideCardText}>
          {financeWorkspace
            ? 'Every claim opens with the exact fields, confidence, and notes Gemini read.'
            : 'Gemini reads bills, UPI screenshots, or a note and fills the claim for you.'}
        </Text>
      </View>

      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {financeWorkspace ? 'MI' : 'PS'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>
            {financeWorkspace ? 'Meera Iyer' : 'Pushpendra Suryawanshi'}
          </Text>
          <Text style={styles.profileRole}>
            {financeWorkspace ? 'Finance Operations • OPE' : 'Investment Banking • OPE'}
          </Text>
        </View>
        <View style={styles.statusDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 252,
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.white,
  },
  brandDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.amber,
  },
  brandName: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.colors.textPrimary,
  },
  brandSub: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 1.1,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  roleSwitch: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceAlt,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
  },
  roleOptionActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  roleOptionText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  roleOptionTextActive: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  newButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.ink,
    marginBottom: 24,
    ...theme.shadows.md,
  },
  newButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(232,201,142,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButtonTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.white,
  },
  newButtonSub: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  financeCard: {
    padding: 13,
    borderRadius: 16,
    backgroundColor: theme.colors.ink,
    marginBottom: 24,
    ...theme.shadows.md,
  },
  financeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  financeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(232,201,142,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  financeLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.amberOnDark,
  },
  financeTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.white,
    marginBottom: 4,
  },
  financeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  navSectionLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textMuted,
    marginLeft: 12,
    marginBottom: 9,
  },
  navList: {
    gap: 4,
  },
  navItem: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 13,
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.amber,
  },
  navIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: theme.colors.surface,
  },
  navText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  navTextActive: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  navHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  spacer: {
    flex: 1,
  },
  sideCard: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    marginBottom: 16,
  },
  sideCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sideCardTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  sideCardText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    lineHeight: 14,
    color: theme.colors.textSecondary,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: theme.colors.white,
  },
  profileName: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  profileRole: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
});
