import { dataReportSchema, reportKinds } from '@flyms/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { fieldErrors, submitPublic } from './api';
import { useTurnstile } from './Turnstile';

const KIND_LABEL: Record<(typeof reportKinds)[number], string> = {
  deadline: 'Deadline or dates are wrong',
  link: 'A link is broken',
  requirement: 'A requirement is wrong',
  fee: 'A fee is wrong',
  other: 'Something else',
};

interface ReportDialogProps {
  programId: string;
  programName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ programId, programName, open, onOpenChange }: ReportDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Report wrong info"
      description={programName}
    >
      {/* Mounted only while open, so the bot check loads on demand. */}
      {open && <ReportForm programId={programId} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function ReportForm({ programId, onDone }: { programId: string; onDone: () => void }) {
  const [kind, setKind] = useState<(typeof reportKinds)[number]>('deadline');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const turnstile = useTurnstile();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = dataReportSchema.safeParse({
      program_id: programId,
      kind,
      message,
      reporter_email: email,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFailure(null);
    setSending(true);
    try {
      const token = await turnstile.getToken();
      await submitPublic({ kind: 'data_report', data: parsed.data }, token);
      toast('Thanks! An admin will check it.');
      onDone();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Something went wrong.');
      turnstile.reset();
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Select
        label="What is wrong?"
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
      >
        {reportKinds.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="report-message" className="text-sm font-medium">
          Details <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="report-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. The deadline is now 31 January — see the official page."
          className="rounded-sm border border-border bg-surface px-3 py-2 text-base placeholder:text-muted focus:border-primary focus:outline-none sm:text-sm"
        />
      </div>
      <Input
        label="Your email (optional)"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="Only if you'd like us to follow up."
        error={errors.reporter_email}
      />
      {turnstile.widget}
      {failure && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send report'}
        </Button>
      </div>
    </form>
  );
}
