import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ReceiptText, Sparkles } from 'lucide-react';
import { extractExpense, uploadAttachmentFiles } from '../../lib/api';
import { rememberExtraction } from '../../lib/draftStore';
import { makeFallbackDraft } from '../../lib/fallbackDraft';
import type { ProcessedFile } from '../../lib/image';
import { FilePicker } from '../../components/employee/FilePicker';
import { AnalysisModal } from '../../components/employee/AnalysisModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { InlineAlert } from '../../components/ui/States';

export function EmployeeNoBillPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [note, setNote] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploads = files.map((file) => ({
    file: file.file,
    name: file.name,
    mime: file.mime,
  }));

  const receiptType = files.length > 0 ? 'payment_screenshot' : 'none';

  const analyze = async () => {
    const cleanNote = note.trim();
    if (files.length === 0 && !cleanNote) {
      setError('Add a screenshot or a note.');
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const draft = await extractExpense(
        uploads,
        cleanNote || undefined,
        'payment_screenshot'
      );
      rememberExtraction(draft);
      navigate('/employee/review');
    } catch (extractionError) {
      try {
        const attachments =
          files.length > 0
            ? await uploadAttachmentFiles(uploads, 'payment_screenshot')
            : [];
        rememberExtraction(
          makeFallbackDraft({
            attachments,
            receiptType,
            reason: cleanNote,
            notice:
              extractionError instanceof Error
                ? extractionError.message
                : 'AI could not read this claim. Add the details manually.',
          })
        );
        navigate('/employee/review');
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : extractionError instanceof Error
              ? extractionError.message
              : 'Could not upload the proof. Try again.'
        );
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const enterManually = () => {
    rememberExtraction(
      makeFallbackDraft({
        attachments: [],
        receiptType: files.length > 0 ? 'payment_screenshot' : 'none',
        reason: note.trim(),
        notice: 'Enter the claim details manually.',
      })
    );
    navigate('/employee/review');
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/employee"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong"
          aria-label="Back to expenses"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">No bill</h1>
          <p className="text-xs text-ink-400">UPI proof or a short note.</p>
        </div>
      </div>

      <Card tone="amber" padding="sm" className="flex items-center gap-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] font-medium text-ink-500">
          Add a payment screenshot, a document, or just the note.
        </p>
      </Card>

      <FilePicker files={files} onChange={setFiles} kind="proof" disabled={analyzing} />

      <Textarea
        label="Note"
        optional
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What was this payment for?"
        maxLength={300}
        disabled={analyzing}
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Button
        size="lg"
        fullWidth
        onClick={() => void analyze()}
        loading={analyzing}
        disabled={files.length === 0 && !note.trim()}
      >
        <ReceiptText className="h-4 w-4" />
        {analyzing ? 'Reading claim…' : 'Continue'}
      </Button>

      <button
        type="button"
        onClick={enterManually}
        disabled={analyzing}
        className="mx-auto block text-[11px] font-semibold text-ink-400 transition-colors hover:text-ink"
      >
        Enter manually instead
      </button>

      <AnalysisModal open={analyzing} title="Reading your claim" />
    </div>
  );
}
