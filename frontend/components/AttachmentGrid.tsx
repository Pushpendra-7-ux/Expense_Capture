import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';

export interface AttachmentTile {
  key: string;
  uri?: string;
  name: string;
  mime?: string;
  isPdf?: boolean;
}

interface AttachmentGridProps {
  items: AttachmentTile[];
  onRemove?: (key: string) => void;
  onOpen?: (item: AttachmentTile) => void;
  size?: number;
}

export function AttachmentGrid({
  items,
  onRemove,
  onOpen,
  size = 76,
}: AttachmentGridProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const isPdf =
          item.isPdf ||
          item.mime === 'application/pdf' ||
          item.name.toLowerCase().endsWith('.pdf');

        return (
          <View key={item.key} style={[styles.tileWrap, { width: size }]}>
            <Pressable
              onPress={() => onOpen?.(item)}
              disabled={!onOpen}
              style={({ pressed }) => [
                styles.tile,
                { width: size, height: size },
                pressed && onOpen ? { opacity: 0.78 } : null,
              ]}
              accessibilityRole={onOpen ? 'button' : undefined}
              accessibilityLabel={
                onOpen ? `Open ${item.name}` : item.name
              }
            >
              {isPdf || !item.uri ? (
                <View style={styles.pdfTile}>
                  <Ionicons
                    name="document-text-outline"
                    size={25}
                    color={theme.colors.amberDeep}
                  />
                  <Text style={styles.pdfLabel}>PDF</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.image}
                  resizeMode="cover"
                />
              )}

              {onRemove ? (
                <Pressable
                  onPress={() => onRemove(item.key)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && { opacity: 0.65 },
                  ]}
                  hitSlop={8}
                  accessibilityLabel={`Remove ${item.name}`}
                >
                  <Ionicons
                    name="close"
                    size={11}
                    color={theme.colors.white}
                  />
                </Pressable>
              ) : null}
            </Pressable>

            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tileWrap: {
    alignItems: 'flex-start',
  },
  tile: {
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pdfTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.amberSoft,
  },
  pdfLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    color: theme.colors.amberDeep,
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 18, 32, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    width: '100%',
    marginTop: 5,
    fontFamily: theme.typography.fontFamily,
    fontSize: 9.5,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
});
