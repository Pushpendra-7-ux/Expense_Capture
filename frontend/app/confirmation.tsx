import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { formatINR } from '../utils/format';

export default function ConfirmationScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const containerMaxWidth = width > 460 ? 420 : width;

  const params = useLocalSearchParams<{
    referenceId?: string;
    amountPaise?: string;
    merchant?: string;
  }>();

  const referenceId = params.referenceId || 'OPE-XXXXXX';
  const amountPaise = parseInt(params.amountPaise || '0', 10);
  const merchant = params.merchant || 'Expense';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centeredWrapper}>
        <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
          {/* ── Checkmark Circle ──────────────────────────── */}
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={56} color={theme.colors.white} />
          </View>

          {/* ── Status Heading ────────────────────────────── */}
          <Text style={styles.heading}>Expense Submitted</Text>
          <Text style={styles.subheading}>
            Your expense claim has been successfully recorded.
          </Text>

          {/* ── Receipt Summary Card ──────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Amount</Text>
              <Text style={styles.cardAmount}>{formatINR(amountPaise)}</Text>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Merchant</Text>
              <Text style={styles.cardValue}>{merchant}</Text>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Reference ID</Text>
              <View style={styles.refBadge}>
                <Text style={styles.refBadgeText}>{referenceId}</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Status</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Submitted</Text>
              </View>
            </View>
          </View>

          {/* ── Action Buttons ────────────────────────────── */}
          <View style={styles.actionSection}>
            <Pressable
              onPress={() => router.replace('/review')}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="add" size={20} color={theme.colors.white} />
              <Text style={styles.primaryBtnText}>Log another</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace('/home')}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.secondaryBtnText}>View my expenses</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  centeredWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },

  // Success Circle
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    ...theme.shadows.lg,
  },

  // Titles
  heading: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingLarge,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subheading: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },

  // Card
  card: {
    width: '100%',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xxxl,
    ...theme.shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  cardLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
  cardAmount: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingMedium,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  cardValue: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },

  // Ref Badge
  refBadge: {
    backgroundColor: theme.colors.navy,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  refBadgeText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },

  // Status Pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  statusText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.success,
  },

  // Actions
  actionSection: {
    width: '100%',
    gap: theme.spacing.md,
  },
  primaryBtn: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    width: '100%',
    ...theme.shadows.md,
  },
  primaryBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.white,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});
