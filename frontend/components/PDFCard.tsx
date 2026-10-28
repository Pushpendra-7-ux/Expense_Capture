import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface PDFCardProps {
  filename: string;
  sizeBytes?: number;
  viewUrl?: string;
  onRemove?: () => void;
}

export function PDFCard({ filename, sizeBytes, viewUrl, onRemove }: PDFCardProps) {
  const handleView = () => {
    if (viewUrl && typeof window !== 'undefined') {
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons name="document-text" size={24} color={theme.colors.indigo} />
      </View>

      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {filename}
        </Text>
        <Text style={styles.meta}>
          PDF Document {sizeBytes ? `• ${formatSize(sizeBytes)}` : ''}
        </Text>
      </View>

      <View style={styles.actions}>
        {viewUrl && (
          <Pressable
            onPress={handleView}
            style={({ pressed }) => [styles.viewBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel={`View ${filename}`}
          >
            <Text style={styles.viewBtnText}>View</Text>
            <Ionicons name="open-outline" size={14} color={theme.colors.indigo} />
          </Pressable>
        )}

        {onRemove && (
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
            accessibilityLabel="Remove file"
          >
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    minHeight: 60,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.indigoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  info: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  filename: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  meta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSecondary,
  },
  viewBtnText: {
    fontFamily: theme.typography.fontFamily,
    ...theme.typography.caption,
    fontWeight: '700',
    color: theme.colors.indigo,
  },
  removeBtn: {
    padding: 4,
  },
});
