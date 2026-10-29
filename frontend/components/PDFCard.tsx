import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
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
    if (!viewUrl) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(viewUrl).catch(() => {});
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons
          name="document-text-outline"
          size={22}
          color={theme.colors.amberDeep}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {filename}
        </Text>
        <Text style={styles.meta}>
          PDF invoice{sizeBytes ? ` • ${formatSize(sizeBytes)}` : ''}
        </Text>
      </View>

      <View style={styles.actions}>
        {viewUrl ? (
          <Pressable
            onPress={handleView}
            style={({ pressed }) => [
              styles.viewBtn,
              pressed && { opacity: 0.65 },
            ]}
            accessibilityLabel={`View ${filename}`}
          >
            <Text style={styles.viewBtnText}>View</Text>
            <Ionicons
              name="open-outline"
              size={13}
              color={theme.colors.amberDeep}
            />
          </Pressable>
        ) : null}

        {onRemove ? (
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [
              styles.removeBtn,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={8}
            accessibilityLabel="Remove file"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 11,
    minHeight: 62,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  filename: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  meta: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.amberSoft,
  },
  viewBtnText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.amberDeep,
  },
  removeBtn: {
    minWidth: 32,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
