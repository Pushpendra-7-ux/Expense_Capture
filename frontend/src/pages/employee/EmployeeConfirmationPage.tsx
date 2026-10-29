import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ReceiptText } from 'lucide-react';
import { recallSubmission } from '../../lib/draftStore';
import { formatINR } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';

export function EmployeeConfirmationPage() {
  const submission = recallSubmission();

  if (!submission) {
    return (
      <div className="animate-fade-in py-8">
        <EmptyState
          title="No recent submission"
          description="This screen shows the claim you just submitted."
          icon={<ReceiptText className="h-5 w-5" />}
          action={
            <Link to="/employee">
              <Button size="sm">Back to expenses</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in py-4">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-success-50 text-success-500">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-[-0.02em] text-ink">
          Claim submitted
        </h1>
        <p className="mt-1 text-sm text-ink-400">Finance will review it shortly.</p>

        <Card padding="md" className="mt-6 w-full text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
                Amount
              </p>
              <p className="mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">
                {formatINR(submission.amountPaise)}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-500">
                {submission.merchant}
              </p>
            </div>
            <span className="rounded-full border border-line bg-cream px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-500">
              {submission.referenceId}
            </span>
          </div>
        </Card>

        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <Link to={`/employee/expenses/${submission.referenceId}`}>
            <Button variant="secondary" fullWidth>
              View claim
            </Button>
          </Link>
          <Link to="/employee">
            <Button fullWidth>
              <ArrowLeft className="h-4 w-4" />
              Expenses
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
