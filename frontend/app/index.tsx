import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

// ─── Toast Component ──────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons
        name="information-circle"
        size={18}
        color={theme.colors.amber}
      />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Role Card Component ──────────────────────────────────────────────
function RoleCard({
  title,
  subtitle,
  active,
  icon,
  onPress,
  comingSoon,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  comingSoon?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active ? styles.cardActive : styles.cardInactive,
        pressed && active && { opacity: 0.9 },
        !active && { opacity: 0.5 },
      ]}
    >
      <View style={styles.cardContent}>
        <View
          style={[
            styles.cardIcon,
            {
              backgroundColor: active
                ? 'rgba(255,255,255,0.15)'
                : theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={24}
            color={active ? theme.colors.white : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.cardTextWrap}>
          <View style={styles.cardTitleRow}>
            <Text
              style={[
                styles.cardTitle,
                {
                  color: active
                    ? theme.colors.white
                    : theme.colors.textPrimary,
                },
              ]}
            >
              {title}
            </Text>
            {comingSoon && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming soon</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.cardSubtitle,
              {
                color: active
                  ? 'rgba(255,255,255,0.7)'
                  : theme.colors.textSecondary,
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={
            active
              ? 'rgba(255,255,255,0.5)'
              : theme.colors.textSecondary
          }
        />
      </View>
    </Pressable>
  );
}

// ─── Welcome Screen ───────────────────────────────────────────────────
export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const containerMaxWidth = width > 460 ? 420 : width;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
          {/* ── Branding ─────────────────────────────────────── */}
          <View style={styles.brandingSection}>
            <Text style={styles.wordmark}>DEXTER CAPITAL</Text>
            <Text style={styles.appTitle}>Expense Capture</Text>
          </View>

          {/* ── Blurb ────────────────────────────────────────── */}
          <Text style={styles.blurb}>
            Dexter Capital is an investment banking firm. Log an expense the
            moment you spend it, in about the time it takes to get into a cab.
          </Text>

          {/* ── Role Cards ───────────────────────────────────── */}
          <View style={styles.cardsSection}>
            <RoleCard
              title="Employee"
              subtitle="Log and view your expenses"
              active={true}
              icon="person-outline"
              onPress={() => router.push('/home')}
            />
            <RoleCard
              title="Finance team"
              subtitle="Review and reconcile"
              active={false}
              icon="stats-chart-outline"
              comingSoon
              onPress={() => showToast('Finance team portal coming soon!')}
            />
            <RoleCard
              title="Super admin"
              subtitle="Manage the workspace"
              active={false}
              icon="shield-checkmark-outline"
              comingSoon
              onPress={() => showToast('Admin portal coming soon!')}
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Toast ───────────────────────────────────────────── */}
      <Toast message={toastMessage} visible={toastVisible} />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },

  // Branding
  brandingSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  wordmark: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.navy,
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
  },
  appTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.displayMedium,
    color: theme.colors.navy,
    textAlign: 'center',
  },

  // Blurb
  blurb: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.sm,
  },

  // Cards
  cardsSection: {
    gap: theme.spacing.md,
  },
  card: {
    borderRadius: theme.radii.lg,
    ...theme.shadows.md,
    minHeight: 80,
    justifyContent: 'center',
  },
  cardActive: {
    backgroundColor: theme.colors.navy,
  },
  cardInactive: {
    backgroundColor: theme.colors.bgSecondary,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  cardTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
  },
  cardSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
  },

  // Coming Soon Badge
  comingSoonBadge: {
    backgroundColor: theme.colors.amber,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  comingSoonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 40,
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    alignSelf: 'center',
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  toastText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.white,
    flex: 1,
  },
});
