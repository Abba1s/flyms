import { questionSchema } from '@flyms/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fieldErrors, submitPublic } from '@/features/submit/api';
import { useTurnstile } from '@/features/submit/Turnstile';

export function AskPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const turnstile = useTurnstile();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = questionSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFailure(null);
    setSending(true);
    try {
      await submitPublic({ kind: 'question', data: parsed.data }, await turnstile.getToken());
      setDone(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Something went wrong.');
      turnstile.reset();
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold">Thanks! Your question was sent.</h1>
        <p className="text-muted">We’ll reply by email, usually within a few days.</p>
        <Link to="/faq" className="font-semibold text-primary hover:underline">
          Browse the FAQ meanwhile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ask a question</h1>
        <p className="mt-1 text-muted">
          About a program, the app, or applying to Germany. Check the{' '}
          <Link to="/faq" className="font-semibold text-primary hover:underline">
            FAQ
          </Link>{' '}
          first — your answer may already be there.
        </p>
      </header>
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
      >
        <Input
          label="Your name"
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email}
          hint="We reply here. Never shared."
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ask-message" className="text-sm font-medium">
            Your question
          </label>
          <textarea
            id="ask-message"
            rows={5}
            maxLength={2000}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            aria-invalid={errors.message ? true : undefined}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-base focus:border-primary focus:outline-none sm:text-sm"
          />
          {errors.message && <p className="text-xs text-danger">{errors.message}</p>}
        </div>
        {turnstile.widget}
        {failure && (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        )}
        <Button type="submit" disabled={sending} className="self-start">
          {sending ? 'Sending…' : 'Send question'}
        </Button>
      </form>
    </div>
  );
}
