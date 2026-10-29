export interface ProcessedFile {
  file: File;
  name: string;
  mime: string;
  size: number;
  previewUrl: string;
  isPdf: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

export async function convertHeicIfNecessary(file: File): Promise<File> {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');
  if (!isHeic) return file;

  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
    });
  } catch {
    throw new Error("Couldn't read this photo. Retake it or choose a JPEG/PNG.");
  }
}

export async function compressImage(file: File): Promise<File> {
  if (isPdfFile(file)) return file;

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxEdge = 1600;
      let { width, height } = image;
      if (width > maxEdge || height > maxEdge) {
        if (width > height) {
          height = Math.round((height * maxEdge) / width);
          width = maxEdge;
        } else {
          width = Math.round((width * maxEdge) / height);
          height = maxEdge;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(file);
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
            })
          );
        },
        'image/jpeg',
        0.85
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read this photo. Retake it or choose a JPEG/PNG."));
    };

    image.src = url;
  });
}

export async function processClientFile(rawFile: File): Promise<ProcessedFile> {
  const pdf = isPdfFile(rawFile);
  if (pdf && rawFile.size > MAX_PDF_BYTES) {
    throw new Error('PDFs must be 10 MB or smaller.');
  }
  if (!pdf && rawFile.size > MAX_IMAGE_BYTES * 2) {
    throw new Error('Images must be 10 MB or smaller.');
  }

  if (pdf) {
    return {
      file: rawFile,
      name: rawFile.name,
      mime: 'application/pdf',
      size: rawFile.size,
      previewUrl: URL.createObjectURL(rawFile),
      isPdf: true,
    };
  }

  if (!rawFile.type.startsWith('image/')) {
    throw new Error('Choose a JPEG, PNG, WebP, HEIC, or PDF.');
  }

  const converted = await convertHeicIfNecessary(rawFile);
  const compressed = await compressImage(converted);
  if (compressed.size > MAX_IMAGE_BYTES) {
    throw new Error('Images must be 5 MB or smaller after compression.');
  }

  return {
    file: compressed,
    name: compressed.name,
    mime: compressed.type || 'image/jpeg',
    size: compressed.size,
    previewUrl: URL.createObjectURL(compressed),
    isPdf: false,
  };
}

export function releasePreview(item: ProcessedFile): void {
  if (item.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(item.previewUrl);
  }
}
