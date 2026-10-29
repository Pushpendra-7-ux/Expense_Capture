import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import {
  AttachmentRecord,
  ExtractedDraft,
  UploadFileInput,
  extractExpense,
  uploadAttachmentFiles,
} from '../utils/api';
import {
  processClientFile,
  releasePreview,
  ProcessedFile,
} from '../utils/image_processing';
import { pickNativeImages, pickNativePdf } from '../utils/file_picker';
import { rememberExtraction } from '../utils/draft_store';
import {
  AttachmentGrid,
  AttachmentTile,
} from '../components/AttachmentGrid';
import {
  AnalysisOverlay,
  AnalysisPhase,
} from '../components/AnalysisOverlay';

function toYYYYMMDD(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function toUploadInput(file: ProcessedFile): UploadFileInput {
  return {
    file: file.file,
    uri: file.uri,
    name: file.name,
    mime: file.mime,
  };
}

export default function NoBillScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;

  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [note, setNote] = useState('');
  const [pickerBusy, setPickerBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<ProcessedFile[]>([]);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  filesRef.current = files;

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (navTimer.current) clearTimeout(navTimer.current);
      filesRef.current.forEach(releasePreview);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'reading') return;

    setStepIndex(0);
    setProgress(10);

    const timers = [
      setTimeout(() => {
        setStepIndex(1);
        setProgress(34);
      }, 750),
      setTimeout(() => {
        setStepIndex(2);
        setProgress(58);
      }, 1650),
      setTimeout(() => {
        setStepIndex(3);
        setProgress(80);
      }, 2700),
    ];

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [phase]);

  const addFiles = (incoming: ProcessedFile[]) => {
    if (incoming.length === 0) return;
    setFiles((previous) => {
      const remaining = Math.max(0, 3 - previous.length);
      const accepted = incoming.slice(0, remaining);
      incoming.slice(remaining).forEach(releasePreview);
      if (incoming.length > remaining) {
        setErrorMessage('You can attach up to 3 proof files.');
      }
      return [...previous, ...accepted];
    });
  };

  const handleWebSelection = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setErrorMessage(null);
    setPickerBusy(true);
    try {
      const processed: ProcessedFile[] = [];
      for (const raw of Array.from(list).slice(0, 3)) {
        processed.push(await processClientFile(raw));
      }
      addFiles(processed);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "Couldn't read that file. Choose a JPEG, PNG, or PDF instead."
      );
    } finally {
      setPickerBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openProofPicker = async (kind: 'image' | 'pdf' = 'image') => {
    if (pickerBusy || phase === 'reading') return;
    if (files.length >= 3) {
      setErrorMessage('You can attach up to 3 proof files.');
      return;
    }
    setErrorMessage(null);

    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    setPickerBusy(true);
    try {
      const remaining = 3 - files.length;
      const picked =
        kind === 'pdf'
          ? await pickNativePdf(remaining)
          : await pickNativeImages('library', remaining);
      addFiles(picked);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not open the picker.');
    } finally {
      setPickerBusy(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((previous) => {
      const next = [...previous];
      const [removed] = next.splice(index, 1);
      if (removed) releasePreview(removed);
      return next;
    });
    setErrorMessage(null);
  };

  const navigateToReview = (nextDraft: ExtractedDraft | null) => {
    rememberExtraction(nextDraft);
    const fields = nextDraft?.fields;
    const attachments = nextDraft?.attachments || [];
    const amount =
      fields?.amount_rupees ||
      (fields?.amount_minor ? (fields.amount_minor / 100).toFixed(2) : '');

    const receiptType =
      nextDraft?.receipt_type ||
      (files.length > 0 ? 'payment_screenshot' : 'none');

    router.push({
      pathname: '/review',
      params: {
        receiptType,
        amount,
        date: fields?.expense_date || toYYYYMMDD(new Date()),
        merchant: fields?.merchant || '',
        category: fields?.category || 'other',
        reason: fields?.reason || nextDraft?.reason_suggestion || note.trim(),
        attachmentIds: JSON.stringify(nextDraft?.attachment_ids || []),
        attachments: JSON.stringify(attachments),
        confidence: JSON.stringify(nextDraft?.confidence || {}),
        notices: JSON.stringify(
          nextDraft?.notices ||
            (nextDraft
              ? []
              : ['Add the missing details manually before submitting.'])
        ),
        conflicts: JSON.stringify(nextDraft?.conflicts || []),
        aiStatus: nextDraft?.status || 'manual',
      },
    });

    // Returning to this screen should show a clean capture state, not the
    // final frame of the analysis overlay.
    setPhase('idle');
    setDraft(null);
    setAnalysisError(null);
  };

  const makeFallbackDraft = (
    uploaded: AttachmentRecord[],
    typedNote: string
  ): ExtractedDraft => ({
    status: 'failed',
    fields: {
      amount_minor: null,
      amount_rupees: '',
      expense_date: toYYYYMMDD(new Date()),
      merchant: null,
      category: 'other',
      reason: typedNote,
      receipt_type: uploaded.length > 0 ? 'payment_screenshot' : 'none',
      txn_ref: null,
      invoice_no: null,
      tax_amount_minor: null,
    },
    confidence: { amount: 0, date: 0.5, merchant: 0, category: 0, reason: 0 },
    receipt_type: uploaded.length > 0 ? 'payment_screenshot' : 'none',
    conflicts: [],
    notices: [
      uploaded.length > 0
        ? 'AI could not read this payment proof. Add the details manually.'
        : 'AI could not read your note. Add the details manually.',
    ],
    attachment_ids: uploaded.map((item) => item.id),
    attachments: uploaded,
  });

  const handleAnalyze = async () => {
    if (phase === 'reading') return;

    const typedNote = note.trim();
    if (files.length === 0 && !typedNote) {
      setErrorMessage(
        'Attach a UPI screenshot or document, or write a note about the payment.'
      );
      return;
    }

    setErrorMessage(null);
    setDraft(null);
    setAnalysisError(null);
    setPhase('reading');
    setProgress(8);

    const uploads = files.map(toUploadInput);

    try {
      const result = await extractExpense(
        uploads,
        typedNote || undefined,
        'payment_screenshot'
      );
      if (!mounted.current) return;

      setDraft(result);
      setProgress(100);

      if (result.status === 'failed') {
        setAnalysisError(result.notices[0] || null);
        setPhase('manual');
        return;
      }

      setPhase('success');
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => {
        if (mounted.current) navigateToReview(result);
      }, 700);
    } catch (extractionError: any) {
      // The extraction endpoint saves attachments before calling the model.
      // If the request died mid-flight, try once more to keep the evidence.
      try {
        const uploaded =
          files.length > 0
            ? await uploadAttachmentFiles(uploads, 'payment_screenshot')
            : [];
        if (!mounted.current) return;

        const fallback = makeFallbackDraft(uploaded, typedNote);
        setDraft(fallback);
        setAnalysisError(fallback.notices[0] || null);
        setPhase('manual');
      } catch (uploadError: any) {
        if (!mounted.current) return;
        setAnalysisError(
          uploadError?.message ||
            extractionError?.message ||
            'Could not reach the extraction service.'
        );
        setPhase('error');
      }
    }
  };

  const handleManualEntry = () => {
    setPhase('idle');
    setDraft(null);
    setAnalysisError(null);
    router.push({
      pathname: '/review',
      params: {
        receiptType: files.length > 0 ? 'payment_screenshot' : 'none',
        amount: '',
        date: toYYYYMMDD(new Date()),
        merchant: '',
        category: 'other',
        reason: note.trim(),
        attachmentIds: '[]',
        attachments: '[]',
        confidence: '{}',
        notices: '[]',
        conflicts: '[]',
        aiStatus: 'manual',
      },
    });
  };

  const attachmentTiles: AttachmentTile[] = files.map((file, index) => ({
    key: `${file.name}::${index}`,
    uri: file.isPdf ? undefined : file.previewUrl,
    name: file.name,
    mime: file.mime,
    isPdf: file.isPdf,
  }));

  const canAnalyze = files.length > 0 || note.trim().length > 0;
  const proofSummary =
    files.length > 0
      ? `${files.length} ${files.length === 1 ? 'file' : 'files'}${
          note.trim() ? ' + note' : ''
        }`
      : 'Your note';

  const fileInput =
    typeof document !== 'undefined' ? (
      <input
        ref={(element) => {
          fileInputRef.current = element;
        }}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => handleWebSelection(event.target.files)}
      />
    ) : null;

  const proofSection = (
    <View style={styles.proofSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>PAYMENT PROOF</Text>
        <Text style={styles.proofHint}>Up to 3 files</Text>
      </View>

      {attachmentTiles.length > 0 ? (
        <>
          <View style={styles.proofGridWrap}>
            <AttachmentGrid
              items={attachmentTiles}
              onRemove={(key) => {
                const index = Number(key.split('::').pop());
                if (Number.isInteger(index) && index >= 0) {
                  removeFile(index);
                }
              }}
            />
          </View>

          {files.length < 3 ? (
            <View style={styles.addRow}>
              <Pressable
                onPress={() => openProofPicker('image')}
                disabled={pickerBusy}
                style={({ pressed }) => [
                  styles.addLink,
                  pressed && { opacity: 0.6 },
                ]}
              >
                {pickerBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textSecondary}
                  />
                ) : (
                  <Ionicons
                    name="add"
                    size={15}
                    color={theme.colors.textSecondary}
                  />
                )}
                <Text style={styles.addLinkText}>Add file</Text>
              </Pressable>

              {Platform.OS !== 'web' ? (
                <Pressable
                  onPress={() => openProofPicker('pdf')}
                  disabled={pickerBusy}
                  style={({ pressed }) => [
                    styles.addLink,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.addLinkText}>Add PDF</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <Pressable
          onPress={() => openProofPicker('image')}
          disabled={pickerBusy}
          style={({ pressed }) => [
            styles.uploadCard,
            pressed && { opacity: 0.82 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add payment proof"
        >
          <View style={styles.uploadIcon}>
            {pickerBusy ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.textSecondary}
              />
            ) : (
              <Ionicons
                name="cloud-upload-outline"
                size={22}
                color={theme.colors.textSecondary}
              />
            )}
          </View>
          <View style={styles.uploadBody}>
            <Text style={styles.uploadTitle}>Add payment proof</Text>
            <Text style={styles.uploadSubtitle}>
              UPI screenshot, receipt, or PDF
            </Text>
          </View>
          <Ionicons name="add" size={20} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );

  const noteSection = (
    <View style={styles.noteSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>ABOUT THIS PAYMENT</Text>
        <Text style={styles.proofHint}>Optional</Text>
      </View>
      <TextInput
        value={note}
        onChangeText={(value) => {
          setNote(value);
          setErrorMessage(null);
        }}
        placeholder="e.g. Paid the auto driver for the client visit. UPI ref 4382190."
        placeholderTextColor={theme.colors.textMuted}
        multiline
        numberOfLines={4}
        maxLength={400}
        editable={phase !== 'reading'}
        style={styles.noteInput}
        accessibilityLabel="Note about this payment"
      />
      <View style={styles.noteMeta}>
        <Text style={styles.noteHint}>Gemini reads this with your proof.</Text>
        <Text style={styles.noteCounter}>{note.length}/400</Text>
      </View>
    </View>
  );

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        {fileInput}
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.desktopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopEyebrow}>NO-BILL CLAIM</Text>
              <Text style={styles.desktopTitle}>Payment without a bill</Text>
              <Text style={styles.desktopSubtitle}>
                Add a UPI screenshot or payment document. Gemini reads the
                amount, payee, and date.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/home')}
              style={({ pressed }) => [
                styles.desktopGhostButton,
                pressed && { opacity: 0.72 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to expenses"
            >
              <Ionicons
                name="arrow-back"
                size={14}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.desktopGhostButtonText}>Expenses</Text>
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={17}
                color={theme.colors.error}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable
                onPress={() => setErrorMessage(null)}
                hitSlop={8}
                accessibilityLabel="Dismiss error"
              >
                <Ionicons name="close" size={16} color={theme.colors.error} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.desktopGrid}>
            <View style={styles.desktopMain}>
              <View style={styles.desktopFormCard}>
                {proofSection}
                <View style={styles.desktopFormDivider} />
                {noteSection}
              </View>

              <View style={styles.desktopFooterNote}>
                <Ionicons
                  name="lock-closed-outline"
                  size={13}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.desktopFooterNoteText}>
                  Your proof stays attached to the claim. No bill is required.
                </Text>
              </View>
            </View>

            <View style={styles.desktopRail}>
              <View style={styles.desktopAnalyzeCard}>
                <View style={styles.desktopAnalyzeTop}>
                  <View style={styles.desktopAnalyzeIcon}>
                    <Ionicons
                      name="sparkles"
                      size={17}
                      color={theme.colors.amberOnDark}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.desktopAnalyzeLabel}>AI CLAIM READER</Text>
                    <Text style={styles.desktopAnalyzeTitle}>
                      {canAnalyze ? 'Ready to analyze' : 'Add proof or a note'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.desktopAnalyzeText}>
                  {canAnalyze
                    ? `Gemini will read ${proofSummary.toLowerCase()} and open an editable draft.`
                    : 'Attach a UPI screenshot, payment document, or describe the payment in a note.'}
                </Text>
                <Pressable
                  onPress={handleAnalyze}
                  disabled={phase === 'reading' || !canAnalyze}
                  style={({ pressed }) => [
                    styles.desktopAnalyzeButton,
                    pressed && canAnalyze && { opacity: 0.9 },
                    !canAnalyze && { opacity: 0.45 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Analyze claim with AI"
                >
                  <Text style={styles.desktopAnalyzeButtonText}>
                    Analyze claim
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={theme.colors.ink}
                  />
                </Pressable>
                <Pressable
                  onPress={handleManualEntry}
                  disabled={phase === 'reading'}
                  style={({ pressed }) => [
                    styles.desktopManualLink,
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Text style={styles.desktopManualLinkText}>
                    Enter details manually
                  </Text>
                </Pressable>
              </View>

              <View style={styles.desktopRailCard}>
                <Text style={styles.desktopSectionLabel}>
                  WHAT GEMINI LOOKS FOR
                </Text>
                <View style={styles.desktopReadList}>
                  {[
                    ['Amount & payee', 'From the UPI confirmation'],
                    ['Date & reference', 'From the transaction line'],
                    ['Purpose', 'From line items and your note'],
                  ].map(([title, hint]) => (
                    <View key={title} style={styles.desktopReadRow}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={14}
                        color={theme.colors.success}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.desktopReadTitle}>{title}</Text>
                        <Text style={styles.desktopReadHint}>{hint}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.desktopRailFoot}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.desktopRailFootText}>
                  Encrypted in transit • Synced with Finance
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <AnalysisOverlay
          phase={phase}
          stepIndex={stepIndex}
          progress={progress}
          context="payment"
          errorMessage={analysisError}
          onContinue={() => {
            if (draft) navigateToReview(draft);
            else handleManualEntry();
          }}
          onRetry={handleAnalyze}
          onDismiss={() => {
            setPhase('idle');
            setDraft(null);
            setAnalysisError(null);
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {fileInput}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { opacity: 0.55 },
            ]}
            hitSlop={10}
            accessibilityLabel="Back"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.wordmark}>DEXTER CAPITAL</Text>
            <Text style={styles.headerTitle}>No-Bill Claim</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>PS</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 162 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>LEDGER ENTRY</Text>
          <Text style={styles.pageTitle}>No-Bill Claim</Text>
          <Text style={styles.pageSubtitle}>
            Upload a UPI payment or document. Gemini fills the rest.
          </Text>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={17}
                color={theme.colors.error}
              />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable
                onPress={() => setErrorMessage(null)}
                hitSlop={8}
                accessibilityLabel="Dismiss error"
              >
                <Ionicons name="close" size={16} color={theme.colors.error} />
              </Pressable>
            </View>
          ) : null}

          {proofSection}

          {noteSection}

          <View style={styles.aiLine}>
            <Ionicons
              name="sparkles-outline"
              size={13}
              color={theme.colors.amberDeep}
            />
            <Text style={styles.aiLineText}>
              Gemini reads every file and your note, then fills the claim.
            </Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerBrandRow}>
              <Text style={styles.footerBrand}>Dexter OPE Instant Ledger</Text>
              <View style={styles.footerDot} />
            </View>
            <View style={styles.footerSecurityRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color={theme.colors.textMuted}
              />
              <Text style={styles.footerSecurity}>
                Encrypted in transit • Synced with Finance
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky analyze bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={handleAnalyze}
            disabled={phase === 'reading' || !canAnalyze}
            style={({ pressed }) => [
              styles.analyzeButton,
              pressed && canAnalyze && { opacity: 0.92 },
              !canAnalyze && styles.analyzeButtonIdle,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Analyze claim with AI"
          >
            <View style={styles.analyzeIcon}>
              <Ionicons
                name="sparkles"
                size={19}
                color={theme.colors.amberOnDark}
              />
            </View>
            <View style={styles.analyzeBody}>
              <Text style={styles.analyzeTitle}>Analyze claim</Text>
              <Text style={styles.analyzeSubtitle}>
                {canAnalyze
                  ? `AI reads ${proofSummary}`
                  : 'Add proof or a note to begin'}
              </Text>
            </View>
            <Ionicons
              name="arrow-forward"
              size={19}
              color="rgba(255,255,255,0.55)"
            />
          </Pressable>

          <Pressable
            onPress={handleManualEntry}
            disabled={phase === 'reading'}
            style={({ pressed }) => [
              styles.manualLink,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name="create-outline"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.manualLinkText}>Enter details manually</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AnalysisOverlay
        phase={phase}
        stepIndex={stepIndex}
        progress={progress}
        context="payment"
        errorMessage={analysisError}
        onContinue={() => {
          if (draft) navigateToReview(draft);
          else handleManualEntry();
        }}
        onRetry={handleAnalyze}
        onDismiss={() => {
          setPhase('idle');
          setDraft(null);
          setAnalysisError(null);
        }}
      />
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
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.colors.white,
  },

  scrollContent: {
    paddingHorizontal: theme.layout.gutter,
    paddingTop: theme.spacing.sm,
  },
  eyebrow: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.amber,
    marginBottom: 7,
  },
  pageTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.colors.textPrimary,
  },
  pageSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    marginTop: 5,
    marginBottom: theme.spacing.xl,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    backgroundColor: theme.colors.errorSoft,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: theme.colors.error,
  },

  proofSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  proofHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  proofGridWrap: {
    marginBottom: 10,
  },
  addRow: {
    flexDirection: 'row',
    gap: 18,
    paddingLeft: 2,
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
  },
  addLinkText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  uploadBody: {
    flex: 1,
    marginRight: 8,
  },
  uploadTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13.5,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  noteSection: {
    marginBottom: theme.spacing.lg,
  },
  noteInput: {
    minHeight: 112,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.typography.fontFamily,
    fontSize: 14.5,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 7,
  },
  noteHint: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    lineHeight: 13,
    color: theme.colors.textMuted,
  },
  noteCounter: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },

  aiLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  aiLineText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: theme.colors.textMuted,
  },

  footer: {
    alignItems: 'center',
    paddingTop: 18,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  footerBrand: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.amber,
  },
  footerSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerSecurity: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: 10,
    backgroundColor: 'rgba(247,248,251,0.97)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  analyzeButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.ink,
    ...theme.shadows.lg,
  },
  analyzeButtonIdle: {
    opacity: 0.45,
  },
  analyzeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(232,201,142,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  analyzeBody: {
    flex: 1,
  },
  analyzeTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
    marginBottom: 2,
  },
  analyzeSubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: 'rgba(255,255,255,0.56)',
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 34,
  },
  manualLinkText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    fontWeight: '500',
    color: theme.colors.textMuted,
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
    paddingTop: 30,
    paddingBottom: 52,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 22,
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
  },
  desktopGhostButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 3,
  },
  desktopGhostButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  desktopMain: {
    flex: 1,
    minWidth: 0,
  },
  desktopFormCard: {
    padding: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  desktopFormDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginTop: 4,
    marginBottom: 20,
  },
  desktopFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 13,
  },
  desktopFooterNoteText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  desktopRail: {
    width: 324,
    flexShrink: 0,
  },
  desktopAnalyzeCard: {
    padding: 17,
    borderRadius: 16,
    backgroundColor: theme.colors.ink,
    marginBottom: 14,
    ...theme.shadows.md,
  },
  desktopAnalyzeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  desktopAnalyzeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(232,201,142,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopAnalyzeLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.amberOnDark,
    marginBottom: 2,
  },
  desktopAnalyzeTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.white,
  },
  desktopAnalyzeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 14,
  },
  desktopAnalyzeButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 10,
    backgroundColor: theme.colors.amberOnDark,
  },
  desktopAnalyzeButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.ink,
  },
  desktopManualLink: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  desktopManualLinkText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  desktopRailCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  desktopSectionLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.amber,
    marginBottom: 12,
  },
  desktopReadList: {
    gap: 10,
  },
  desktopReadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  desktopReadTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  desktopReadHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  desktopRailFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  desktopRailFootText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    color: theme.colors.textMuted,
  },
});
