/**
 * utils/image_processing.ts — Client-side image processing for Expense Capture (OPE).
 *
 * Rules:
 * 1. Convert HEIC/HEIF to JPEG in the browser.
 *    On failure, display: "Couldn't read this photo. Retake it or choose a JPEG/PNG."
 * 2. Compress images client-side: max 1600px long edge, JPEG quality 0.85.
 * 3. Never compress or modify PDFs.
 */

export interface ProcessedFile {
  file: File;
  name: string;
  mime: string;
  size: number;
  previewUrl: string;
  isPdf: boolean;
}

/**
 * Convert HEIC/HEIF file to JPEG if needed.
 */
export async function convertHeicIfNecessary(file: File): Promise<File> {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');

  if (!isHeic) {
    return file;
  }

  try {
    // Dynamically import heic2any on web client
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });

    const blob = Array.isArray(converted) ? converted[0] : converted;
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (err) {
    throw new Error(
      "Couldn't read this photo. Retake it or choose a JPEG/PNG."
    );
  }
}

/**
 * Resize and compress an image file client-side using HTML5 Canvas.
 * Limits longest edge to 1600px, converts to JPEG quality 0.85.
 */
export async function compressImage(file: File): Promise<File> {
  // Never touch PDFs
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return file;
  }

  // If running outside browser DOM environment, return original
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_EDGE = 1600;
      let width = img.width;
      let height = img.height;

      if (width > MAX_EDGE || height > MAX_EDGE) {
        if (width > height) {
          height = Math.round((height * MAX_EDGE) / width);
          width = MAX_EDGE;
        } else {
          width = Math.round((width * MAX_EDGE) / height);
          height = MAX_EDGE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(file);
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve(file);
          }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
          });
          resolve(compressed);
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read this photo. Retake it or choose a JPEG/PNG."));
    };

    img.src = url;
  });
}

/**
 * Full processing pipeline for an uploaded file:
 * 1. HEIC conversion
 * 2. Canvas compression
 * 3. Create blob URL for preview
 */
export async function processClientFile(rawFile: File): Promise<ProcessedFile> {
  const isPdf =
    rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    return {
      file: rawFile,
      name: rawFile.name,
      mime: 'application/pdf',
      size: rawFile.size,
      previewUrl: URL.createObjectURL(rawFile),
      isPdf: true,
    };
  }

  // 1. HEIC to JPEG
  const unHeic = await convertHeicIfNecessary(rawFile);

  // 2. Compress image
  const compressed = await compressImage(unHeic);

  return {
    file: compressed,
    name: compressed.name,
    mime: compressed.type || 'image/jpeg',
    size: compressed.size,
    previewUrl: URL.createObjectURL(compressed),
    isPdf: false,
  };
}
