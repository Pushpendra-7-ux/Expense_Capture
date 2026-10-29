import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Sparkles } from 'lucide-react';
import { extractExpense, uploadAttachmentFiles } from '../../lib/api';
import { rememberExtraction } from '../../lib/draftStore';
import { makeFallbackDraft } from '../../lib/fallbackDraft';
import type { ProcessedFile } from '../../lib/image';
import { FilePicker } from '../../components/employee/FilePicker';
import { AnalysisModal } from '../../components/employee/AnalysisModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { InlineAlert } from '../../components/ui/States';

export function EmployeeSnapPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploads = files.map((file) => ({
    file: file.file,
    name: file.name,
    mime: file.mime,
  }));

  const analyze = async () => {
    if (files.length === 0) {
      setError('Add a bill first.');
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const draft = await extractExpense(uploads, undefined, 'bill');
      rememberExtraction(draft);
      navigate('/employee/review');
    } catch (extractionError) {
      try {
        const attachments = await uploadAttachmentFiles(uploads, 'bill');
        rememberExtraction(
          makeFallbackDraft({
            attachments,
            receiptType: 'bill_photo',
            notice:
              extractionError instanceof Error
                ? extractionError.message
                : 'AI could not read this bill. Add the details manually.',
          })
        );
        navigate('/employee/review');
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : extractionError instanceof Error
              ? extractionError.message
              : 'Could not upload the bill. Try again.'
        );
      }
    } finally {
      setAnalyzing(false);
    }
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
          <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">Snap a bill</h1>
          <p className="text-xs text-ink-400">AI reads it. You check it.</p>
        </div>
      </div>

      <Card tone="amber" padding="sm" className="flex items-center gap-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] font-medium text-ink-500">
          Amount, date, payee, and purpose are filled for you.
        </p>
      </Card>

      <FilePicker files={files} onChange={setFiles} kind="bill" disabled={analyzing} />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Button
        size="lg"
        fullWidth
        onClick={() => void analyze()}
        loading={analyzing}
        disabled={files.length === 0}
      >
        <Camera className="h-4 w-4" />
        {analyzing ? 'Reading bill…' : 'Read bill'}
      </Button>

      <p className="text-center text-[10px] text-ink-400">
        Up to 3 photos of the same bill.
      </p>

      <AnalysisModal open={analyzing} />
    </div>
  );
}
