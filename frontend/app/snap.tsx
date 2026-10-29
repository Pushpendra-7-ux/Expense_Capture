import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import {
  extractExpense,
  uploadAttachmentFiles,
  AttachmentRecord,
  ExtractedDraft,
  UploadFileInput,
} from '../utils/api';
import {
  processClientFile,
  releasePreview,
  ProcessedFile,
} from '../utils/image_processing';
import { rememberExtraction } from '../utils/draft_store';
import { pickNativeImages, pickNativePdf } from '../utils/file_picker';
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

function CornerBrackets() {
  return (
    <>
      <View style={[styles.corner, styles.cornerTopLeft]} />
      <View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} />
      <View style={[styles.corner, styles.cornerBottomRight]} />
    </>
  );
}

function GhostReceipt() {
  return (
    <View style={styles.ghostWrap} pointerEvents="none">
      <View style={styles.ghostReceipt}>
        <Text style={styles.ghostBrand}>DEXTER CAPITAL</Text>
        <Text style={styles.ghostAddress}>60 COLLINS STREET • MELBOURNE</Text>
        <View style={[styles.ghostRule, { marginTop: 12 }]} />
        <View style={[styles.ghostLine, { width: '86%' }]} />
        <View style={[styles.ghostLine, { width: '72%' }]} />
        <View style={[styles.ghostLine, { width: '91%' }]} />
        <View style={[styles.ghostLine, { width: '64%' }]} />
        <View style={[styles.ghostRule, { marginTop: 8 }]} />
        <View style={[styles.ghostLine, { width: '78%' }]} />
        <View style={[styles.ghostLine, { width: '56%' }]} />
        <View style={styles.ghostTotalRow}>
          <View style={[styles.ghostLine, { width: '30%' }]} />
          <View style={[styles.ghostLine, { width: '24%' }]} />
        </View>
      </View>
    </View>
  );
}

export default function QuickCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= theme.layout.desktopBreakpoint;

  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(8);
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (navTimer.current) clearTimeout(navTimer.current);
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
      if (remaining === 0) {
        setErrorMessage('You can attach up to 3 files to one claim.');
        incoming.forEach(releasePreview);
        return previous;
      }
      const accepted = incoming.slice(0, remaining);
      incoming.slice(remaining).forEach(releasePreview);
      if (incoming.length > remaining) {
        setErrorMessage('Only the first 3 files were added.');
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
          "Couldn't read that file. Choose a JPEG, PNG, or PDF and try again."
      );
    } finally {
      setPickerBusy(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (libraryInputRef.current) libraryInputRef.current.value = '';
    }
  };

  const handleNativeSelection = async (
    source: 'camera' | 'library' | 'pdf'
  ) => {
    if (files.length >= 3) {
      setErrorMessage('You can attach up to 3 files to one claim.');
      return;
    }
    setErrorMessage(null);
    setPickerBusy(true);
    try {
      const remaining = 3 - files.length;
      const picked =
        source === 'pdf'
          ? await pickNativePdf(remaining)
          : await pickNativeImages(source, source === 'camera' ? 1 : remaining);
      addFiles(picked);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not open the picker.');
    } finally {
      setPickerBusy(false);
    }
  };

  const openSource = (source: 'camera' | 'library' | 'pdf') => {
    if (pickerBusy || phase === 'reading') return;
    if (source !== 'pdf' && files.length >= 3) {
      setErrorMessage('You can attach up to 3 files to one claim.');
      return;
    }
    if (Platform.OS === 'web') {
      if (source === 'camera') cameraInputRef.current?.click();
      else libraryInputRef.current?.click();
      return;
    }
    handleNativeSelection(source);
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

    router.push({
      pathname: '/review',
      params: {
        receiptType:
          nextDraft?.receipt_type || (attachments.length > 0 ? 'bill_photo' : 'none'),
        amount,
        date: fields?.expense_date || toYYYYMMDD(new Date()),
        merchant: fields?.merchant || '',
        category: fields?.category || 'other',
        reason: fields?.reason || nextDraft?.reason_suggestion || '',
        attachmentIds: JSON.stringify(nextDraft?.attachment_ids || []),
        attachments: JSON.stringify(attachments),
        confidence: JSON.stringify(nextDraft?.confidence || {}),
        notices: JSON.stringify(
          nextDraft?.notices ||
            (nextDraft
              ? []
              : ['The file could not be uploaded. Please enter the details manually.'])
        ),
        conflicts: JSON.stringify(nextDraft?.conflicts || []),
        aiStatus: nextDraft?.status || 'failed',
      },
    });

    // Returning to this screen should show a clean capture state, not the
    // final frame of the analysis overlay.
    setPhase('idle');
    setDraft(null);
    setAnalysisError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || phase === 'reading') return;

    setAnalysisError(null);
    setDraft(null);
    setPhase('reading');
    setProgress(8);

    const uploads = files.map(toUploadInput);

    try {
      const result = await extractExpense(uploads);
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
      // The API saves attachments before calling the model. If the AI call
      // failed but the upload succeeded, keep the evidence and continue.
      try {
        const uploaded = await uploadAttachmentFiles(uploads, 'bill');
        if (!mounted.current) return;

        const fallback = makeFallbackDraft(uploaded, files);
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

  const makeFallbackDraft = (
    uploaded: AttachmentRecord[],
    sourceFiles: ProcessedFile[]
  ): ExtractedDraft => ({
    status: 'failed',
    fields: {
      amount_minor: null,
      amount_rupees: '',
      expense_date: toYYYYMMDD(new Date()),
      merchant: null,
      category: 'other',
      reason: '',
      receipt_type: 'bill_photo',
      txn_ref: null,
      invoice_no: null,
      tax_amount_minor: null,
    },
    confidence: { amount: 0, date: 0.5, merchant: 0, category: 0, reason: 0 },
    receipt_type: 'bill_photo',
    conflicts: [],
    notices: [
      sourceFiles.length > 1
        ? 'AI could not read these files. Add the details manually.'
        : 'AI could not read this bill. Add the details manually.',
    ],
    attachment_ids: uploaded.map((item) => item.id),
    attachments: uploaded,
  });

  const dismissAnalysis = () => {
    if (phase === 'reading') return;
    setPhase('idle');
    setDraft(null);
    setAnalysisError(null);
  };

  const analyzing = phase === 'reading';
  const canAddMore = files.length < 3;
  const currentFile = files[0];

  const captureContent = (
    <>
      <CornerBrackets />

      {currentFile ? (
        currentFile.isPdf ? (
          <View style={styles.selectedPdf}>
            <View style={styles.selectedPdfIcon}>
              <Ionicons
                name="document-text-outline"
                size={34}
                color={theme.colors.amberDeep}
              />
            </View>
            <Text style={styles.selectedPdfName} numberOfLines={2}>
              {currentFile.name}
            </Text>
            <Text style={styles.selectedPdfMeta}>PDF invoice attached</Text>
          </View>
        ) : (
          <Image
            source={{ uri: currentFile.previewUrl }}
            style={styles.selectedImage}
            resizeMode="cover"
          />
        )
      ) : (
        <>
          <GhostReceipt />
          <View style={styles.cameraBubble}>
            <Ionicons
              name="camera"
              size={24}
              color={theme.colors.textPrimary}
            />
          </View>
          <Text style={styles.viewfinderTitle}>
            {desktop ? 'Click to add a bill' : 'Align bill in frame'}
          </Text>
          <Text style={styles.viewfinderSubtitle}>
            {desktop
              ? 'Photo or PDF invoice • up to 10 MB'
              : 'Tap viewport to snap immediately'}
          </Text>
        </>
      )}

      {currentFile ? (
        <View style={styles.selectedBadge}>
          <View style={styles.readyDot} />
          <Text style={styles.selectedBadgeText}>
            {files.length} {files.length === 1 ? 'FILE' : 'FILES'} ATTACHED
          </Text>
        </View>
      ) : (
        <View style={styles.readyBadge}>
          <View style={styles.readyDot} />
          <Text style={styles.readyText}>READY TO AUTO-DETECT</Text>
        </View>
      )}

      {pickerBusy ? (
        <View style={styles.pickerBusyOverlay}>
          <ActivityIndicator size="small" color={theme.colors.amberDeep} />
          <Text style={styles.pickerBusyText}>Preparing photo…</Text>
        </View>
      ) : null}
    </>
  );

  const primaryAction = (
    <Pressable
      onPress={() => openSource('camera')}
      disabled={!canAddMore || pickerBusy || analyzing}
      style={({ pressed }) => [
        styles.primaryCard,
        (pressed || pickerBusy) && { opacity: 0.92 },
        (!canAddMore || analyzing) && { opacity: 0.45 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Take Photo"
    >
      <View style={styles.primaryIcon}>
        <Ionicons
          name="scan-outline"
          size={25}
          color={theme.colors.amberOnDark}
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.primaryTitle}>Take Photo</Text>
        <Text style={styles.primarySubtitle}>
          Auto edge lock & perspective crop
        </Text>
      </View>
      <Ionicons
        name="arrow-forward"
        size={21}
        color="rgba(255,255,255,0.62)"
      />
    </Pressable>
  );

  const secondaryAction = (
    <Pressable
      onPress={() => openSource('library')}
      disabled={!canAddMore || pickerBusy || analyzing}
      style={({ pressed }) => [
        styles.secondaryCard,
        pressed && { opacity: 0.82 },
        (!canAddMore || analyzing) && { opacity: 0.45 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Choose from Photos"
    >
      <View style={styles.secondaryIcon}>
        <Ionicons
          name="images-outline"
          size={23}
          color={theme.colors.iconInk}
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.secondaryTitle}>Choose from Photos</Text>
        <Text style={styles.secondarySubtitle}>
          Select PDF invoice or high-res capture
        </Text>
      </View>
      <Ionicons
        name="arrow-up-outline"
        size={20}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );

  const fileRow = files.length > 0 ? (
    <View style={styles.fileRow}>
      <View style={styles.fileRowInfo}>
        <View style={styles.fileRowIcon}>
          <Ionicons
            name={currentFile?.isPdf ? 'document-text-outline' : 'image-outline'}
            size={15}
            color={theme.colors.iconInk}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fileRowName} numberOfLines={1}>
            {currentFile?.name || 'Receipt'}
          </Text>
          <Text style={styles.fileRowMeta}>
            {files.length} of 3 • JPEG or PDF accepted
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => {
          files.forEach(releasePreview);
          setFiles([]);
        }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.clearButton,
          pressed && { opacity: 0.6 },
        ]}
        accessibilityLabel="Remove all files"
      >
        <Text style={styles.clearButtonText}>Clear</Text>
      </Pressable>
    </View>
  ) : null;

  const fileInputs =
    typeof document !== 'undefined' ? (
      <>
        <input
          ref={(element) => {
            cameraInputRef.current = element;
          }}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(event) => handleWebSelection(event.target.files)}
        />
        <input
          ref={(element) => {
            libraryInputRef.current = element;
          }}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => handleWebSelection(event.target.files)}
        />
      </>
    ) : null;

  if (desktop) {
    return (
      <View style={styles.desktopPage}>
        {fileInputs}
        <ScrollView
          contentContainerStyle={styles.desktopScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.desktopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.desktopEyebrow}>QUICK CAPTURE</Text>
              <Text style={styles.desktopTitle}>New expense</Text>
              <Text style={styles.desktopSubtitle}>
                Scan a bill or invoice. Gemini fills the draft in about 30
                seconds.
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
                size={16}
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
              <Pressable
                onPress={() => openSource('camera')}
                disabled={pickerBusy || analyzing}
                style={({ pressed }) => [
                  styles.desktopViewfinder,
                  pressed && { opacity: 0.94 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Take a photo of the bill"
              >
                {captureContent}
              </Pressable>

              {fileRow}

              <View style={styles.desktopActions}>
                <View style={{ flex: 1 }}>{primaryAction}</View>
                <View style={{ flex: 1 }}>{secondaryAction}</View>
              </View>

              {Platform.OS !== 'web' && canAddMore ? (
                <Pressable
                  onPress={() => openSource('pdf')}
                  disabled={pickerBusy || analyzing}
                  style={({ pressed }) => [
                    styles.pdfLink,
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.pdfLinkText}>
                    Have a PDF invoice? Upload it
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.desktopCaptureFoot}>
                <Ionicons
                  name="image-outline"
                  size={14}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.desktopCaptureFootText}>
                  JPEG, PNG, or PDF • up to 3 files • 10 MB each
                </Text>
              </View>
            </View>

            <View style={styles.desktopRail}>
              <View style={styles.desktopRailCard}>
                <Text style={styles.desktopSectionLabel}>HOW CAPTURE WORKS</Text>
                <View style={styles.desktopSteps}>
                  {[
                    'Photograph the bill or upload a PDF invoice',
                    'Gemini reads amount, date, payee, and purpose',
                    'Check the draft, add a category, and submit',
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
                    <Text style={styles.desktopAnalyzeLabel}>AI EXTRACTION</Text>
                    <Text style={styles.desktopAnalyzeTitle}>
                      {files.length > 0
                        ? `${files.length} ${
                            files.length === 1 ? 'file' : 'files'
                          } ready`
                        : 'Add a bill to start'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.desktopAnalyzeText}>
                  {files.length > 0
                    ? 'Gemini will read the file and open an editable draft for review.'
                    : 'Use the viewfinder or choose a high-resolution photo or PDF invoice.'}
                </Text>
                <Pressable
                  onPress={handleAnalyze}
                  disabled={files.length === 0 || analyzing}
                  style={({ pressed }) => [
                    styles.desktopAnalyzeButton,
                    pressed && { opacity: 0.9 },
                    files.length === 0 && { opacity: 0.45 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Analyze bill with AI"
                >
                  <Text style={styles.desktopAnalyzeButtonText}>
                    Analyze bill
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={theme.colors.ink}
                  />
                </Pressable>
                <Text style={styles.desktopAnalyzeHint}>
                  You can edit every field before filing.
                </Text>
              </View>

              <View style={styles.desktopRailCard}>
                <Text style={styles.desktopSectionLabel}>
                  WHAT GEMINI READS
                </Text>
                <View style={styles.desktopReadList}>
                  {[
                    ['Amount & tax', 'From the bill total'],
                    ['Date & payee', 'From the receipt header'],
                    ['Purpose & category', 'From line items and context'],
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
          context="bill"
          errorMessage={analysisError}
          onContinue={() => {
            if (draft) navigateToReview(draft);
          }}
          onRetry={handleAnalyze}
          onDismiss={dismissAnalysis}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {fileInputs}

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          disabled={analyzing}
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
          <Text style={styles.headerTitle}>Quick Capture</Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>PS</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (files.length > 0 ? 116 : 40) + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>LEDGER ENTRY</Text>
        <Text style={styles.pageTitle}>New Expense</Text>
        <Text style={styles.pageSubtitle}>
          Scan receipt or bill to auto-extract details
        </Text>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
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

        {/* Viewfinder */}
        <Pressable
          onPress={() => openSource('camera')}
          disabled={pickerBusy || analyzing}
          style={({ pressed }) => [
            styles.viewfinder,
            pressed && { opacity: 0.94 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Take a photo of the bill"
        >
          {captureContent}
        </Pressable>

        {fileRow}

        {/* Primary action */}
        {primaryAction}

        {/* Secondary action */}
        {secondaryAction}

        {Platform.OS !== 'web' && canAddMore ? (
          <Pressable
            onPress={() => openSource('pdf')}
            disabled={pickerBusy || analyzing}
            style={({ pressed }) => [
              styles.pdfLink,
              pressed && { opacity: 0.65 },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={14}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.pdfLinkText}>Have a PDF invoice? Upload it</Text>
          </Pressable>
        ) : null}

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
              All captures securely synced with Finance
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky analyze bar */}
      {files.length > 0 && phase === 'idle' ? (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            onPress={handleAnalyze}
            style={({ pressed }) => [
              styles.analyzeButton,
              pressed && { opacity: 0.92 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Analyze bill with AI"
          >
            <View style={styles.analyzeIcon}>
              <Ionicons name="sparkles" size={19} color={theme.colors.amberOnDark} />
            </View>
            <View style={styles.analyzeBody}>
              <Text style={styles.analyzeTitle}>Analyze bill</Text>
              <Text style={styles.analyzeSubtitle}>
                AI auto-fill • {files.length} {files.length === 1 ? 'file' : 'files'}
              </Text>
            </View>
            <Ionicons
              name="arrow-forward"
              size={20}
              color="rgba(255,255,255,0.62)"
            />
          </Pressable>
        </View>
      ) : null}

      {/* AI analysis overlay */}
      <AnalysisOverlay
        phase={phase}
        stepIndex={stepIndex}
        progress={progress}
        context="bill"
        errorMessage={analysisError}
        onContinue={() => {
          if (draft) navigateToReview(draft);
        }}
        onRetry={handleAnalyze}
        onDismiss={dismissAnalysis}
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
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -1.1,
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

  viewfinder: {
    width: '100%',
    aspectRatio: 1.03,
    minHeight: 330,
    borderRadius: 26,
    backgroundColor: '#F2F3F6',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
    marginBottom: 14,
  },
  corner: {
    position: 'absolute',
    width: 27,
    height: 27,
    borderColor: '#334155',
    zIndex: 3,
  },
  cornerTopLeft: {
    top: 17,
    left: 17,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 17,
    right: 17,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 17,
    left: 17,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 17,
    right: 17,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },

  ghostWrap: {
    position: 'absolute',
    top: 28,
    left: '18%',
    right: '18%',
    height: '56%',
    opacity: 0.55,
  },
  ghostReceipt: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,24,40,0.05)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  ghostBrand: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#8A8F99',
    textAlign: 'center',
  },
  ghostAddress: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 5.5,
    letterSpacing: 0.5,
    color: '#A4A8B0',
    textAlign: 'center',
    marginTop: 4,
  },
  ghostRule: {
    height: 1,
    backgroundColor: 'rgba(16,24,40,0.12)',
    marginBottom: 8,
  },
  ghostLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(16,24,40,0.13)',
    marginBottom: 6,
  },
  ghostTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cameraBubble: {
    position: 'absolute',
    top: '39%',
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(16,24,40,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    ...theme.shadows.md,
  },
  viewfinderTitle: {
    position: 'absolute',
    top: '64%',
    left: 30,
    right: 30,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  viewfinderSubtitle: {
    position: 'absolute',
    top: '71%',
    left: 30,
    right: 30,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
  readyBadge: {
    position: 'absolute',
    bottom: 15,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
    zIndex: 5,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.amber,
  },
  readyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: theme.colors.textPrimary,
  },

  selectedImage: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 56,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
  },
  selectedPdf: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 56,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  selectedPdfIcon: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  selectedPdfName: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  selectedPdfMeta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 5,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 15,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.ink,
    zIndex: 5,
  },
  selectedBadgeText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.colors.white,
  },
  pickerBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(247,248,251,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    zIndex: 10,
  },
  pickerBusyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  fileRowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  fileRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: theme.colors.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileRowName: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  fileRowMeta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  clearButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: theme.colors.textSecondary,
  },

  primaryCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 22,
    backgroundColor: '#0A0C10',
    marginBottom: 12,
    ...theme.shadows.md,
  },
  primaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(232,201,142,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(232,201,142,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardBody: {
    flex: 1,
    marginRight: 10,
  },
  primaryTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.25,
    color: theme.colors.white,
    marginBottom: 3,
  },
  primarySubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.56)',
  },
  secondaryCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 22,
    backgroundColor: '#F0F2F5',
    borderWidth: 1,
    borderColor: '#E7EAF0',
  },
  secondaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  secondaryTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  secondarySubtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  pdfLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    marginTop: 8,
  },
  pdfLinkText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline',
  },

  footer: {
    alignItems: 'center',
    marginTop: 30,
    paddingBottom: 8,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  footerBrand: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
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
    fontSize: 10.5,
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
  desktopViewfinder: {
    width: '100%',
    height: 442,
    borderRadius: 24,
    backgroundColor: '#F2F3F6',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  desktopActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  desktopCaptureFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 14,
  },
  desktopCaptureFootText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  desktopRail: {
    width: 324,
    flexShrink: 0,
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
  desktopSteps: {
    gap: 11,
  },
  desktopStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  desktopStepNumber: {
    width: 20,
    height: 20,
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
  desktopAnalyzeHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 9,
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'center',
    marginTop: 9,
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
