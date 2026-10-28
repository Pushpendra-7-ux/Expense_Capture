import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { processClientFile, ProcessedFile } from '../utils/image_processing';
import { extractExpense, uploadAttachmentFiles } from '../utils/api';
import { PDFCard } from '../components/PDFCard';

export default function SnapBillScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const containerMaxWidth = width > 460 ? 420 : width;

  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hidden file input references for Web
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelection = async (selectedFileList: FileList | null) => {
    if (!selectedFileList || selectedFileList.length === 0) return;
    setErrorMessage(null);

    const availableSlots = 3 - files.length;
    if (availableSlots <= 0) {
      setErrorMessage('Maximum 3 files allowed per bill.');
      return;
    }

    const filesToProcess = Array.from(selectedFileList).slice(0, availableSlots);
    setProcessing(true);

    try {
      const processedList: ProcessedFile[] = [];
      for (const raw of filesToProcess) {
        const item = await processClientFile(raw);
        processedList.push(item);
      }
      setFiles((prev) => [...prev, ...processedList]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error processing photo. Please try again.');
    } finally {
      setProcessing(false);
      // Reset inputs so user can pick again
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (pickerInputRef.current) pickerInputRef.current.value = '';
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
    if (files.length === 0) return;
    setUploading(true);
    setErrorMessage(null);

    try {
      const rawFiles = files.map((f) => f.file);
      const draft = await extractExpense(rawFiles);

      // Navigate to review form with prefilled extracted draft
      router.push({
        pathname: '/review',
        params: {
          receiptType: draft.receipt_type || 'bill_photo',
          amount: draft.fields.amount_rupees || '',
          date: draft.fields.expense_date || '',
          merchant: draft.fields.merchant || '',
          category: draft.fields.category || 'other',
          reason: draft.fields.reason || '',
          attachmentIds: JSON.stringify(draft.attachment_ids || []),
          confidence: JSON.stringify(draft.confidence || {}),
          notices: JSON.stringify(draft.notices || []),
          conflicts: JSON.stringify(draft.conflicts || []),
        },
      });
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Could not extract bill. Please try again or fill in manually.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Hidden browser file inputs for web */}
      {typeof document !== 'undefined' && (
        <>
          <input
            ref={(el) => (cameraInputRef.current = el)}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelection(e.target.files)}
          />
          <input
            ref={(el) => (pickerInputRef.current = el)}
            type="file"
            accept="image/*,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelection(e.target.files)}
          />
        </>
      )}

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
          <Text style={styles.headerTitle}>Snap a bill</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, { maxWidth: containerMaxWidth }]}>
          {/* ── Error Banner ────────────────────────────── */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* ── Static Tips Card ────────────────────────── */}
          <View style={styles.tipsCard}>
            <View style={styles.tipsIconWrap}>
              <Ionicons name="bulb-outline" size={20} color={theme.colors.amber} />
            </View>
            <View style={styles.tipsTextWrap}>
              <Text style={styles.tipsTitle}>Tips for clear capture</Text>
              <Text style={styles.tipsSubtitle}>
                Fit the whole bill in the photo. Good light helps.
              </Text>
            </View>
          </View>

          {/* ── Attached Files List ─────────────────────── */}
          {files.length > 0 && (
            <View style={styles.attachedSection}>
              <View style={styles.attachedHeader}>
                <Text style={styles.attachedTitle}>
                  ATTACHED FILES ({files.length} of 3)
                </Text>
                <Text style={styles.attachedSub}>All parts of ONE bill</Text>
              </View>

              {files.map((item, idx) => (
                <View key={idx} style={styles.fileRow}>
                  {item.isPdf ? (
                    <PDFCard
                      filename={item.name}
                      sizeBytes={item.size}
                      viewUrl={item.previewUrl}
                      onRemove={() => handleRemoveFile(idx)}
                    />
                  ) : (
                    <View style={styles.imageThumbnailCard}>
                      <Image
                        source={{ uri: item.previewUrl }}
                        style={styles.thumbnailImg}
                        resizeMode="cover"
                      />
                      <View style={styles.thumbnailMeta}>
                        <Text style={styles.thumbnailName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.thumbnailSize}>
                          {(item.size / 1024).toFixed(0)} KB • Photo {idx + 1}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveFile(idx)}
                        style={({ pressed }) => [
                          styles.removeBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                        hitSlop={8}
                        accessibilityLabel="Remove photo"
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
              ))}

              {/* Add another photo chip if < 3 */}
              {files.length < 3 && (
                <Pressable
                  onPress={() => pickerInputRef.current?.click()}
                  style={({ pressed }) => [
                    styles.addMoreChip,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="add" size={16} color={theme.colors.indigo} />
                  <Text style={styles.addMoreText}>+ Add another photo</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Action Buttons ──────────────────────────── */}
          <View style={styles.buttonsSection}>
            {/* Take Photo */}
            <Pressable
              onPress={() => cameraInputRef.current?.click()}
              disabled={files.length >= 3 || processing || uploading}
              style={({ pressed }) => [
                styles.primaryCaptureBtn,
                pressed && { opacity: 0.9 },
                (files.length >= 3 || processing || uploading) && { opacity: 0.5 },
              ]}
            >
              <View style={styles.captureIconWrap}>
                <Ionicons name="camera" size={24} color={theme.colors.white} />
              </View>
              <View style={styles.captureTextWrap}>
                <Text style={styles.captureTitle}>Take photo</Text>
                <Text style={styles.captureSub}>Capture directly with your camera</Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="rgba(255,255,255,0.6)"
              />
            </Pressable>

            {/* Choose from Library or PDF */}
            <Pressable
              onPress={() => pickerInputRef.current?.click()}
              disabled={files.length >= 3 || processing || uploading}
              style={({ pressed }) => [
                styles.secondaryCaptureBtn,
                pressed && { opacity: 0.8 },
                (files.length >= 3 || processing || uploading) && { opacity: 0.5 },
              ]}
            >
              <View style={styles.secondaryIconWrap}>
                <Ionicons name="images-outline" size={22} color={theme.colors.navy} />
              </View>
              <View style={styles.captureTextWrap}>
                <Text style={styles.secondaryTitle}>Choose photo or PDF</Text>
                <Text style={styles.secondarySub}>Select high-res image or invoice file</Text>
              </View>
              <Ionicons
                name="arrow-up-circle-outline"
                size={22}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Processing Indicator */}
          {processing && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={theme.colors.indigo} />
              <Text style={styles.processingText}>Processing photo…</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky Bottom Continue Bar ──────────────────── */}
      {files.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={[styles.bottomBarInner, { maxWidth: containerMaxWidth }]}>
            <Pressable
              onPress={handleContinue}
              disabled={uploading}
              style={({ pressed }) => [
                styles.continueBtn,
                pressed && { opacity: 0.9 },
                uploading && { opacity: 0.7 },
              ]}
            >
              {uploading ? (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={theme.colors.white} />
                  <Text style={styles.continueBtnText}>Reading your bill…</Text>
                </View>
              ) : (
                <Text style={styles.continueBtnText}>
                  Continue with {files.length} {files.length === 1 ? 'file' : 'files'}
                </Text>
              )}
            </Pressable>
          </View>
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
    width: 40,
    height: 40,
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

  // Tips Card
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  tipsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  tipsTextWrap: {
    flex: 1,
  },
  tipsTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.textAmber,
    marginBottom: 2,
  },
  tipsSubtitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
  },

  // Attached Section
  attachedSection: {
    marginBottom: theme.spacing.xl,
  },
  attachedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  attachedTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.label,
    color: theme.colors.textAmber,
  },
  attachedSub: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  fileRow: {
    marginBottom: theme.spacing.sm,
  },
  imageThumbnailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  thumbnailImg: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSecondary,
  },
  thumbnailMeta: {
    flex: 1,
  },
  thumbnailName: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  thumbnailSize: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  addMoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: theme.colors.indigoBg,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    marginTop: 4,
  },
  addMoreText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.indigo,
  },

  // Buttons Section
  buttonsSection: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  primaryCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    minHeight: 80,
    ...theme.shadows.md,
  },
  captureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  captureTextWrap: {
    flex: 1,
  },
  captureTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginBottom: 2,
  },
  captureSub: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
  },
  secondaryCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    minHeight: 80,
  },
  secondaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  secondaryTitle: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.headingSmall,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  secondarySub: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },

  // Processing
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  processingText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodySmall,
    color: theme.colors.indigo,
  },

  // Bottom Continue Bar
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
