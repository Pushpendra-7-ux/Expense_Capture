import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { processClientFile, ProcessedFile } from '../utils/image_processing';
import { extractExpense, uploadAttachmentFiles } from '../utils/api';
import { PDFCard } from '../components/PDFCard';

interface TaggedFile extends ProcessedFile {
  slot: 'proof' | 'supporting';
}

export default function NoBillScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const containerMaxWidth = width > 460 ? 420 : width;

  const [files, setFiles] = useState<TaggedFile[]>([]);
  const [note, setNote] = useState<string>('');
  const [activeSlot, setActiveSlot] = useState<'proof' | 'supporting'>('proof');
  const [processing, setProcessing] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalFiles = files.length;
  const canContinue = totalFiles > 0 || note.trim().length > 0;

  const openPickerForSlot = (slot: 'proof' | 'supporting') => {
    if (totalFiles >= 3) {
      setErrorMessage('Maximum 3 files allowed across both slots.');
      return;
    }
    setActiveSlot(slot);
    setErrorMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (selectedList: FileList | null) => {
    if (!selectedList || selectedList.length === 0) return;
    const available = 3 - totalFiles;
    if (available <= 0) return;

    setProcessing(true);
    setErrorMessage(null);

    try {
      const chosen = Array.from(selectedList).slice(0, available);
      const newItems: TaggedFile[] = [];
      for (const f of chosen) {
        const processed = await processClientFile(f);
        newItems.push({ ...processed, slot: activeSlot });
      }
      setFiles((prev) => [...prev, ...newItems]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not process file.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    setUploading(true);
    setErrorMessage(null);

    const hasProof = files.some((f) => f.slot === 'proof');

    try {
      const rawFiles = files.map((f) => f.file);
      let draft;
      try {
        draft = await extractExpense(rawFiles, note.trim() || undefined);
      } catch (extractErr: any) {
        // Fallback per spec: if extraction fails, keep files and route to manual form
        try {
          const uploaded = rawFiles.length > 0
            ? await uploadAttachmentFiles(rawFiles, hasProof ? 'payment_screenshot' : 'supporting')
            : [];
          draft = {
            status: 'failed' as const,
            fields: {
              amount_minor: null,
              amount_rupees: '',
              expense_date: '',
              merchant: '',
              category: 'other' as const,
              reason: note.trim() || '',
              receipt_type: hasProof ? ('payment_screenshot' as const) : ('none' as const),
              txn_ref: null,
              invoice_no: null,
              tax_amount_minor: null,
            },
            confidence: { amount: 0, date: 0.5, merchant: 0, category: 0, reason: 0 },
            notices: ['AI extraction unavailable. Please enter details manually.'],
            conflicts: [],
            attachment_ids: uploaded.map((u) => u.id),
            receipt_type: hasProof ? ('payment_screenshot' as const) : ('none' as const),
          };
        } catch {
          throw extractErr;
        }
      }

      router.push({
        pathname: '/review',
        params: {
          receiptType:
            draft.receipt_type ||
            (hasProof ? 'payment_screenshot' : 'none'),
          amount: draft.fields.amount_rupees || '',
          date: draft.fields.expense_date || '',
          merchant: draft.fields.merchant || '',
          category: draft.fields.category || 'other',
          reason: draft.fields.reason || note.trim(),
          attachmentIds: JSON.stringify(draft.attachment_ids || []),
          confidence: JSON.stringify(draft.confidence || {}),
          notices: JSON.stringify(draft.notices || []),
          conflicts: JSON.stringify(draft.conflicts || []),
        },
      });
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Could not process submission. Please try again or fill in manually.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFillMyself = async () => {
    const hasProof = files.some((f) => f.slot === 'proof');
    let attIds: string[] = [];
    if (files.length > 0) {
      try {
        const uploaded = await uploadAttachmentFiles(
          files.map((f) => f.file),
          hasProof ? 'payment_screenshot' : 'supporting'
        );
        attIds = uploaded.map((u) => u.id);
      } catch {}
    }
    router.push({
      pathname: '/review',
      params: {
        receiptType: hasProof ? 'payment_screenshot' : 'none',
        reason: note.trim() || '',
        attachmentIds: JSON.stringify(attIds),
      },
    });
  };

  const proofFiles = files.filter((f) => f.slot === 'proof');
  const supportingFiles = files.filter((f) => f.slot === 'supporting');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Hidden Web file input */}
      {typeof document !== 'undefined' && (
        <input
          ref={(el) => {
            fileInputRef.current = el;
          }}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelection(e.target.files)}
        />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Top Header ────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            hitSlop={12}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerLabel}>DEXTER CAPITAL</Text>
            <Text style={styles.headerTitle}>No bill? UPI & others</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
            {/* ── Counter Bar ─────────────────────────────── */}
            <View style={styles.counterBar}>
              <Text style={styles.counterText}>
                ATTACHMENTS ({totalFiles} of 3)
              </Text>
              <Text style={styles.counterHint}>
                Optional proof & context
              </Text>
            </View>

            {/* ── Error Banner ────────────────────────────── */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* ── SLOT 1: Payment Proof ────────────────────── */}
            <View style={styles.slotSection}>
              <Text style={styles.slotLabel}>1. PAYMENT PROOF (OPTIONAL)</Text>
              <Text style={styles.slotSubtitle}>
                UPI or bank screenshot, payment SMS, or transaction PDF
              </Text>

              {proofFiles.map((item, idx) => {
                const globalIndex = files.indexOf(item);
                return (
                  <View key={`proof-${idx}`} style={styles.fileCardWrap}>
                    {item.isPdf ? (
                      <PDFCard
                        filename={item.name}
                        sizeBytes={item.size}
                        viewUrl={item.previewUrl}
                        onRemove={() => handleRemoveFile(globalIndex)}
                      />
                    ) : (
                      <View style={styles.thumbnailCard}>
                        <Image
                          source={{ uri: item.previewUrl }}
                          style={styles.thumbImg}
                          resizeMode="cover"
                        />
                        <View style={styles.thumbMeta}>
                          <Text style={styles.thumbName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.thumbSize}>
                            {(item.size / 1024).toFixed(0)} KB • Payment proof
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveFile(globalIndex)}
                          style={styles.thumbRemove}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color={theme.colors.textSecondary}
                          />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              {totalFiles < 3 && (
                <Pressable
                  onPress={() => openPickerForSlot('proof')}
                  disabled={processing || uploading}
                  style={({ pressed }) => [
                    styles.slotUploadCard,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="card-outline" size={24} color={theme.colors.navy} />
                  <Text style={styles.slotUploadText}>
                    + Add payment proof (photo or PDF)
                  </Text>
                </Pressable>
              )}
            </View>

            {/* ── SLOT 2: Supporting Document ─────────────── */}
            <View style={styles.slotSection}>
              <Text style={styles.slotLabel}>2. SUPPORTING DOC (OPTIONAL)</Text>
              <Text style={styles.slotSubtitle}>
                Cab booking, chat, invitation, or order confirmation screenshot
              </Text>

              {supportingFiles.map((item, idx) => {
                const globalIndex = files.indexOf(item);
                return (
                  <View key={`support-${idx}`} style={styles.fileCardWrap}>
                    {item.isPdf ? (
                      <PDFCard
                        filename={item.name}
                        sizeBytes={item.size}
                        viewUrl={item.previewUrl}
                        onRemove={() => handleRemoveFile(globalIndex)}
                      />
                    ) : (
                      <View style={styles.thumbnailCard}>
                        <Image
                          source={{ uri: item.previewUrl }}
                          style={styles.thumbImg}
                          resizeMode="cover"
                        />
                        <View style={styles.thumbMeta}>
                          <Text style={styles.thumbName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.thumbSize}>
                            {(item.size / 1024).toFixed(0)} KB • Supporting doc
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveFile(globalIndex)}
                          style={styles.thumbRemove}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color={theme.colors.textSecondary}
                          />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              {totalFiles < 3 && (
                <Pressable
                  onPress={() => openPickerForSlot('supporting')}
                  disabled={processing || uploading}
                  style={({ pressed }) => [
                    styles.slotUploadCard,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="document-attach-outline" size={24} color={theme.colors.navy} />
                  <Text style={styles.slotUploadText}>
                    + Add supporting doc
                  </Text>
                </Pressable>
              )}
            </View>

            {/* ── Optional Note ───────────────────────────── */}
            <View style={styles.noteSection}>
              <View style={styles.noteLabelRow}>
                <Text style={styles.slotLabel}>ADD A NOTE (OPTIONAL)</Text>
                <Text style={styles.noteCounter}>{note.length}/500</Text>
              </View>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Late client debrief with Anand & Shekhar, cab"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            {/* ── Skip Link: Fill it in myself ────────────── */}
            <Pressable
              onPress={handleFillMyself}
              style={({ pressed }) => [
                styles.fillMyselfBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.fillMyselfText}>Fill it in myself</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── Sticky Bottom Continue Bar ──────────────────── */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={[styles.bottomBarInner, { maxWidth: containerMaxWidth }]}>
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue || uploading || processing}
              style={({ pressed }) => [
                styles.continueBtn,
                pressed && { opacity: 0.9 },
                (!canContinue || uploading || processing) && { opacity: 0.4 },
              ]}
            >
              {uploading ? (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={theme.colors.white} />
                  <Text style={styles.continueBtnText}>Reading your bill…</Text>
                </View>
              ) : (
                <Text style={styles.continueBtnText}>Continue</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  backBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 110,
  },
  container: {
    width: '100%',
  },

  // Counter
  counterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  counterText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  counterHint: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    flex: 1,
  },

  // Slots
  slotSection: {
    marginBottom: theme.spacing.xl,
  },
  slotLabel: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
    marginBottom: 2,
  },
  slotSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  fileCardWrap: {
    marginBottom: theme.spacing.sm,
  },
  thumbnailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  thumbImg: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSecondary,
  },
  thumbMeta: {
    flex: 1,
  },
  thumbName: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  thumbSize: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  thumbRemove: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  slotUploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    minHeight: 64,
  },
  slotUploadText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.navy,
  },

  // Note
  noteSection: {
    marginBottom: theme.spacing.xl,
  },
  noteLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  noteCounter: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgPrimary,
    padding: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    color: theme.colors.textPrimary,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  // Fill myself link
  fillMyselfBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  fillMyselfText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.indigo,
    textDecorationLine: 'underline',
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  bottomBarInner: {
    width: '100%',
  },
  continueBtn: {
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...theme.shadows.md,
  },
  continueBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.white,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
});
