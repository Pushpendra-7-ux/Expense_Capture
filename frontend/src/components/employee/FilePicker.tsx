import { useRef, useState } from 'react';
import {
  Camera,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { InlineAlert } from '../ui/States';
import { processClientFile, releasePreview, type ProcessedFile } from '../../lib/image';
import { cn } from '../../lib/cn';

interface FilePickerProps {
  files: ProcessedFile[];
  onChange: (files: ProcessedFile[]) => void;
  kind?: 'bill' | 'proof';
  disabled?: boolean;
}

export function FilePicker({
  files,
  onChange,
  kind = 'bill',
  disabled = false,
}: FilePickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length || disabled) return;
    setError(null);
    const remaining = 3 - files.length;
    if (remaining <= 0) {
      setError('Up to 3 files per claim.');
      return;
    }

    const selected = Array.from(list).slice(0, remaining);
    if (list.length > remaining) {
      setError('Only the first 3 files were added.');
    }

    setBusy(true);
    const processed: ProcessedFile[] = [];
    try {
      for (const file of selected) {
        processed.push(await processClientFile(file));
      }
      onChange([...files, ...processed]);
    } catch (uploadError) {
      processed.forEach(releasePreview);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Could not read that file. Try a JPEG, PNG, or PDF.'
      );
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (libraryRef.current) libraryRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const next = [...files];
    const [removed] = next.splice(index, 1);
    if (removed) releasePreview(removed);
    onChange(next);
  };

  const clearAll = () => {
    files.forEach(releasePreview);
    onChange([]);
    setError(null);
  };

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void addFiles(event.target.files)}
        disabled={disabled}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => void addFiles(event.target.files)}
        disabled={disabled}
      />
    </>
  );

  if (files.length === 0) {
    return (
      <div className="space-y-3">
        {inputs}
        <div className="rounded-2xl border border-dashed border-line-strong bg-cream/60 p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ink shadow-card">
              {kind === 'bill' ? (
                <Camera className="h-4 w-4" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-xs font-bold text-ink">
                {kind === 'bill' ? 'Add a bill' : 'Add payment proof'}
              </p>
              <p className="text-[10px] text-ink-400">JPEG, PNG, HEIC, or PDF · up to 3</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => cameraRef.current?.click()}
              disabled={busy || disabled}
              className="px-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Take photo
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => libraryRef.current?.click()}
              disabled={busy || disabled}
              className="px-2"
            >
              <ImagePlus className="h-4 w-4" />
              Choose file
            </Button>
          </div>
        </div>
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inputs}
      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream">
              {file.isPdf ? (
                <FileText className="h-5 w-5 text-ink-400" />
              ) : (
                <img
                  src={file.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{file.name}</p>
              <p className="text-[10px] text-ink-400">
                {(file.size / 1024 / 1024).toFixed(1)} MB ·{' '}
                {file.isPdf ? 'PDF' : 'Image'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-line-soft hover:text-ink"
              aria-label={`Remove ${file.name}`}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {files.length < 3 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => libraryRef.current?.click()}
            disabled={busy || disabled}
          >
            <Plus className="h-3.5 w-3.5" />
            Add another
          </Button>
        ) : (
          <span className="text-[10px] text-ink-400">3 files attached</span>
        )}
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled}
          className={cn(
            'rounded-lg px-2 py-1 text-[10px] font-semibold text-ink-400 transition-colors hover:text-danger-500',
            disabled && 'opacity-50'
          )}
        >
          Clear all
        </button>
      </div>
      {busy ? (
        <p className="text-[10px] font-medium text-ink-400">Preparing files…</p>
      ) : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </div>
  );
}
