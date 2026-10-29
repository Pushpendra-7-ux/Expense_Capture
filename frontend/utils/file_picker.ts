import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { ProcessedFile } from './image_processing';

const MAX_EDGE = 1600;

function jpegName(name?: string | null): string {
  const base = (name || `receipt_${Date.now()}`).replace(/\.(heic|heif|png|webp|jpeg|jpg)$/i, '');
  return `${base}.jpg`;
}

async function normaliseImage(asset: ImagePicker.ImagePickerAsset): Promise<ProcessedFile> {
  const longest = Math.max(asset.width || 0, asset.height || 0);
  const actions =
    longest > MAX_EDGE
      ? [
          asset.width >= asset.height
            ? { resize: { width: MAX_EDGE } }
            : { resize: { height: MAX_EDGE } },
        ]
      : [];

  // Even without a resize this converts HEIC (and other camera formats) to a
  // JPEG the API accepts, while keeping the image legible.
  const result = await manipulateAsync(asset.uri, actions, {
    compress: 0.84,
    format: SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    name: jpegName(asset.fileName),
    mime: 'image/jpeg',
    size: asset.fileSize || 0,
    previewUrl: result.uri,
    isPdf: false,
  };
}

/**
 * Native camera / photo-library selection. Web uses the capture screen's
 * hidden <input> elements so the browser can provide native camera UX.
 */
export async function pickNativeImages(
  source: 'camera' | 'library',
  limit: number
): Promise<ProcessedFile[]> {
  if (Platform.OS === 'web') {
    throw new Error('Use the browser file picker on web.');
  }

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera access is needed to photograph a bill.');
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo access is needed to choose a bill.');
    }
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 1,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: Math.max(1, limit),
          quality: 1,
        });

  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, limit).map(normaliseImage));
}

/** Native PDF picker for invoice files. */
export async function pickNativePdf(limit: number): Promise<ProcessedFile[]> {
  if (Platform.OS === 'web') {
    throw new Error('Use the browser file picker on web.');
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf'],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return [];

  return result.assets.slice(0, limit).map((asset) => ({
    uri: asset.uri,
    name: asset.name || `invoice_${Date.now()}.pdf`,
    mime: asset.mimeType || 'application/pdf',
    size: asset.size || 0,
    previewUrl: asset.uri,
    isPdf: true,
  }));
}
