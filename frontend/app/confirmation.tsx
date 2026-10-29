import React from 'react';
import {
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

import { theme } from '../theme';
import { formatINR } from '../utils/format';

export default function ConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;

  const params = useLocalSearchParams<{
    referenceId?: string;
    amountPaise?: string;
    merchant?: string;
  }>();

  const referenceId = params.referenceId || 'OPE-XXXXXX';
  const amountPaise = parseInt(params.amountPaise || '0', 10);
  const merchant = params.merchant || 'Expense';

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.desktopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopEyebrow}>SAVED TO LEDGER</Text>
              <Text style={styles.desktopTitle}>Expense submitted</Text>
              <Text style={styles.desktopSubtitle}>
                Your claim is in the finance queue with every attachment and AI
                reading preserved.
              </Text>
            </View>
            <View style={styles.desktopRefPill}>
              <Text style={styles.desktopRefText}>{referenceId}</Text>
            </View>
          </View>

          <View style={styles.desktopCard}>
            <View style={styles.desktopCardLeft}>
              <View style={styles.successRing}>
                <View style={styles.successCircle}>
                  <Ionicons
                    name="checkmark"
                    size={40}
                    color={theme.colors.success}
                  />
                </View>
              </View>
              <Text style={styles.desktopAmount}>{formatINR(amountPaise)}</Text>
              <Text style={styles.desktopMerchant}>{merchant}</Text>
              <View style={styles.desktopStatusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Submitted</Text>
              </View>
            </View>

            <View style={styles.desktopDivider} />

            <View style={styles.desktopCardRight}>
              <Text style={styles.desktopCardLabel}>CLAIM RECORD</Text>
              <View style={styles.desktopMetaRow}>
                <Text style={styles.rowLabel}>Reference</Text>
                <Text style={styles.desktopMetaValue}>{referenceId}</Text>
              </View>
              <View style={styles.desktopMetaRow}>
                <Text style={styles.rowLabel}>Status</Text>
                <Text style={styles.desktopMetaValue}>Awaiting finance review</Text>
              </View>
              <View style={styles.desktopMetaRow}>
                <Text style={styles.rowLabel}>Access</Text>
                <View style={styles.readonlyRow}>
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.readonlyText}>Read-only</Text>
                </View>
              </View>

              <View style={styles.desktopNextCard}>
                <View style={styles.nextIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={16}
                    color={theme.colors.amberDeep}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desktopNextTitle}>
                    What happens next
                  </Text>
                  <Text style={styles.desktopNextText}>
                    Finance reviews the claim and the Gemini extraction. The
                    decision appears in your feed immediately.
                  </Text>
                </View>
              </View>

              <View style={styles.desktopActions}>
                <Pressable
                  onPress={() => router.replace('/home')}
                  style={({ pressed }) => [
                    styles.desktopPrimary,
                    pressed && { opacity: 0.92 },
                  ]}
                  accessibilityLabel="Back to expenses feed"
                >
                  <Text style={styles.desktopPrimaryText}>Back to ledger</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={17}
                    color={theme.colors.white}
                  />
                </Pressable>
                <Pressable
                  onPress={() => router.replace('/snap')}
                  style={({ pressed }) => [
                    styles.desktopSecondary,
                    pressed && { opacity: 0.72 },
                  ]}
                  accessibilityLabel="Log another expense"
                >
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.desktopSecondaryText}>
                    Log another expense
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.desktopFoot}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.footerText}>
              Dexter OPE Instant Ledger • Cryptographically Verified
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.wordmark}>DEXTER CAPITAL</Text>
          <Text style={styles.headerTitle}>Confirmation</Text>
        </View>
        <View style={styles.headerDot} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 20 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.successWrap}>
            <View style={styles.successRing}>
              <View style={styles.successCircle}>
                <Ionicons
                  name="checkmark"
                  size={40}
                  color={theme.colors.success}
                />
              </View>
            </View>
          </View>

          <Text style={styles.eyebrow}>SAVED TO LEDGER</Text>
          <Text style={styles.title}>Expense submitted</Text>
          <Text style={styles.subtitle}>
            Your claim is in the ledger and ready for Finance to review.
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.amount}>{formatINR(amountPaise)}</Text>
            <Text style={styles.merchant}>{merchant}</Text>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reference</Text>
              <View style={styles.referencePill}>
                <Text style={styles.referenceText}>{referenceId}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Submitted</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Access</Text>
              <View style={styles.readonlyRow}>
                <Ionicons
                  name="lock-closed"
                  size={11}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.readonlyText}>Read-only</Text>
              </View>
            </View>
          </View>

          <View style={styles.nextCard}>
            <View style={styles.nextIcon}>
              <Ionicons
                name="receipt-outline"
                size={17}
                color={theme.colors.amberDeep}
              />
            </View>
            <Text style={styles.nextText}>
              You'll find this claim at the top of your Expenses Feed.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => router.replace('/home')}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.92 },
              ]}
              accessibilityLabel="Back to expenses feed"
            >
              <Text style={styles.primaryButtonText}>Back to ledger</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={theme.colors.white}
              />
            </Pressable>

            <Pressable
              onPress={() => router.replace('/snap')}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && { opacity: 0.72 },
              ]}
              accessibilityLabel="Log another expense"
            >
              <Ionicons
                name="camera-outline"
                size={17}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.secondaryButtonText}>
                Log another expense
              </Text>
            </Pressable>
          </View>

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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
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
  headerDot: {
    position: 'absolute',
    right: 24,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.amber,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: 6,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },

  successWrap: {
    marginTop: 18,
    marginBottom: 18,
  },
  successRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: theme.colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },

  eyebrow: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.amber,
    marginBottom: 8,
  },
  title: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
    maxWidth: 310,
  },

  summaryCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 15,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  amount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  merchant: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginBottom: 8,
  },
  row: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  referencePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: theme.colors.ink,
  },
  referenceText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: theme.colors.white,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.success,
  },
  readonlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readonlyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },

  nextCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceAlt,
    marginBottom: 20,
  },
  nextIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },

  actions: {
    width: '100%',
    gap: 9,
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.ink,
    ...theme.shadows.md,
  },
  primaryButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 15.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  secondaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    paddingBottom: 8,
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

  // Desktop web
  desktopPage: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  desktopScroll: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 36,
    paddingTop: 40,
    paddingBottom: 56,
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
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.3,
    color: theme.colors.textPrimary,
  },
  desktopSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 6,
    maxWidth: 520,
  },
  desktopRefPill: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 3,
  },
  desktopRefText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: theme.colors.textSecondary,
  },
  desktopCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  desktopCardLeft: {
    width: 354,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 28,
    backgroundColor: theme.colors.ink,
  },
  desktopAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: theme.colors.white,
    marginTop: 20,
    textAlign: 'center',
  },
  desktopMerchant: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    marginTop: 2,
  },
  desktopStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    marginTop: 18,
  },
  desktopDivider: {
    width: 1,
    backgroundColor: theme.colors.borderLight,
  },
  desktopCardRight: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  desktopCardLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: theme.colors.textMuted,
    marginBottom: 7,
  },
  desktopMetaRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  desktopMetaValue: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  desktopNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 12,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    marginTop: 22,
    marginBottom: 22,
  },
  desktopNextTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  desktopNextText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: theme.colors.textSecondary,
  },
  desktopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  desktopPrimary: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 11,
    backgroundColor: theme.colors.ink,
    ...theme.shadows.sm,
  },
  desktopPrimaryText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.colors.white,
  },
  desktopSecondary: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  desktopSecondaryText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  desktopFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
  },
});
