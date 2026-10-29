import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';

export type AnalysisPhase = 'idle' | 'reading' | 'success' | 'manual' | 'error';

const BILL_STEPS = [
  'Securing the receipt',
  'Reading merchant & amount',
  'Checking date & taxes',
  'Preparing your draft',
];

const PAYMENT_STEPS = [
  'Securing the payment proof',
  'Reading amount & payee',
  'Checking date & reference',
  'Preparing your draft',
];

interface AnalysisOverlayProps {
  phase: AnalysisPhase;
  stepIndex: number;
  progress: number;
  context: 'bill' | 'payment';
  errorMessage?: string | null;
  onContinue: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

export function AnalysisOverlay({
  phase,
  stepIndex,
  progress,
  context,
  errorMessage,
  onContinue,
  onRetry,
  onDismiss,
}: AnalysisOverlayProps) {
  if (phase === 'idle') return null;

  const isPayment = context === 'payment';
  const steps = isPayment ? PAYMENT_STEPS : BILL_STEPS;

  const title =
    phase === 'reading'
      ? isPayment
        ? 'Reading your payment'
        : 'Reading your bill'
      : phase === 'success'
      ? 'Draft ready'
      : phase === 'manual'
      ? 'Almost there'
      : 'Connection lost';

  const subtitle =
    phase === 'reading'
      ? isPayment
        ? 'Gemini is reading the payment proof and your note. This usually takes a few seconds.'
        : 'Gemini is extracting the amount, date, and merchant. This usually takes a few seconds.'
      : phase === 'success'
      ? 'Opening the review screen so you can check every field.'
      : phase === 'manual'
      ? errorMessage || 'We saved the file, but some details need your help.'
      : errorMessage || 'We could not reach the extraction service.';

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View
          style={[
            styles.icon,
            phase === 'error' && styles.iconError,
            phase === 'manual' && styles.iconWarn,
            phase === 'success' && styles.iconSuccess,
          ]}
        >
          {phase === 'reading' ? (
            <>
              <Ionicons
                name="scan-outline"
                size={28}
                color={theme.colors.amberDeep}
              />
              <ActivityIndicator
                size="small"
                color={theme.colors.amber}
                style={styles.spinner}
              />
            </>
          ) : (
            <Ionicons
              name={
                phase === 'success'
                  ? 'checkmark'
                  : phase === 'manual'
                  ? 'create-outline'
                  : 'cloud-offline-outline'
              }
              size={28}
              color={
                phase === 'success'
                  ? theme.colors.success
                  : phase === 'manual'
                  ? theme.colors.amberDeep
                  : theme.colors.error
              }
            />
          )}
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {phase === 'reading' || phase === 'success' ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.steps}>
              {steps.map((label, index) => {
                const complete = phase === 'success' || index < stepIndex;
                const active = phase === 'reading' && index === stepIndex;
                return (
                  <View key={label} style={styles.stepRow}>
                    {complete ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={theme.colors.success}
                      />
                    ) : active ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.amber}
                        style={{ width: 16, transform: [{ scale: 0.65 }] }}
                      />
                    ) : (
                      <View style={styles.stepDot} />
                    )}
                    <Text
                      style={[
                        styles.stepText,
                        (complete || active) && styles.stepTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {phase === 'manual' ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [
                styles.primary,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.primaryText}>
                {isPayment ? 'Continue to review' : 'Continue manually'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={17}
                color={theme.colors.white}
              />
            </Pressable>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.secondary,
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={styles.secondaryText}>
                {isPayment ? 'Back to payment proof' : 'Back to capture'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                styles.primary,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="refresh" size={16} color={theme.colors.white} />
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [
                styles.secondary,
                pressed && { opacity: 0.65 },
              ]}
            >
              <Text style={styles.secondaryText}>Enter details manually</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'reading' ? (
          <Text style={styles.footnote}>
            Your files are encrypted in transit.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,10,15,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 200,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    ...theme.shadows.lg,
  },
  icon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconSuccess: {
    backgroundColor: theme.colors.successSoft,
    borderColor: theme.colors.successBorder,
  },
  iconWarn: {
    backgroundColor: theme.colors.amberSoft,
    borderColor: theme.colors.amberBorder,
  },
  iconError: {
    backgroundColor: theme.colors.errorSoft,
    borderColor: theme.colors.errorBorder,
  },
  spinner: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 2,
  },
  title: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.45,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 7,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceSunken,
    overflow: 'hidden',
    marginBottom: 17,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.amber,
  },
  steps: {
    width: '100%',
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.borderStrong,
    marginLeft: 5,
  },
  stepText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    color: theme.colors.textMuted,
  },
  stepTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    marginTop: 20,
    gap: 9,
  },
  primary: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.ink,
  },
  primaryText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.white,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  footnote: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    marginTop: 16,
  },
});
