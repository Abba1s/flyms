import { reviewRelations, reviewSchema } from '@flyms/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { fieldErrors, submitPublic } from '@/features/submit/api';
import { useTurnstile } from '@/features/submit/Turnstile';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const RELATION_LABEL: Record<(typeof reviewRelations)[number], string> = {
  current_student: 'Current student',
  alumni: 'Alumni',
  admitted: 'Admitted',
  applicant: 'Applicant',
};

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  relation: (typeof reviewRelations)[number];
  display_name: string;
  created_at: string;
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className} role="img" aria-label={`${value} out of 5 stars`}>
      <span aria-hidden className="tracking-wider text-[#E0A100]">
        {'★'.repeat(Math.round(value))}
        <span className="text-border">{'★'.repeat(5 - Math.round(value))}</span>
      </span>
    </span>
  );
}

export function ReviewsSection({
  programId,
  programName,
  avg,
  count,
}: {
  programId: string;
  programName: string;
  avg: number | null;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', programId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_public_reviews')
        .select('id, rating, comment, relation, display_name, created_at')
        .eq('program_id', programId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Review[];
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Reviews
          {count > 0 && avg !== null && (
            <span className="ml-2 text-sm font-normal text-muted">
              <Stars value={avg} /> {avg.toFixed(1)} · {count}
            </span>
          )}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Write a review
        </Button>
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">
          No reviews yet. Studied here or got admitted? Help others decide.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {reviews.map((r) => (
            <li key={r.id} className="py-3 first:pt-0">
              <p className="text-sm">
                <Stars value={r.rating} /> <strong>{r.display_name}</strong>{' '}
                <span className="text-muted">
                  · {RELATION_LABEL[r.relation]} · {formatDate(r.created_at.slice(0, 10))}
                </span>
              </p>
              {r.comment && <p className="mt-1 whitespace-pre-line text-sm">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen} title="Write a review" description={programName}>
        {open && <ReviewForm programId={programId} onDone={() => setOpen(false)} />}
      </Dialog>
    </section>
  );
}

function ReviewForm({ programId, onDone }: { programId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    rating: 0,
    relation: 'current_student',
    display_name: '',
    comment: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const turnstile = useTurnstile();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = reviewSchema.safeParse({ ...form, program_id: programId });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSending(true);
    try {
      await submitPublic({ kind: 'review', data: parsed.data }, await turnstile.getToken());
      toast('Thanks! Your review will appear after moderation.');
      onDone();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Something went wrong.');
      turnstile.reset();
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={form.rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setForm((f) => ({ ...f, rating: n }))}
              className={`text-3xl leading-none ${n <= form.rating ? 'text-[#E0A100]' : 'text-border'}`}
            >
              ★
            </button>
          ))}
        </div>
        {errors.rating && <p className="mt-1 text-xs text-danger">Choose a rating.</p>}
      </fieldset>
      <Select
        label="You are…"
        value={form.relation}
        onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))}
      >
        {reviewRelations.map((r) => (
          <option key={r} value={r}>
            {RELATION_LABEL[r]}
          </option>
        ))}
      </Select>
      <Input
        label="Display name"
        value={form.display_name}
        onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
        hint="Shown publicly. A first name is fine."
        error={errors.display_name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-comment" className="text-sm font-medium">
          Your experience <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={2000}
          value={form.comment}
          onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          placeholder="Teaching, workload, support for international students, job prospects…"
          className="rounded-sm border border-border bg-surface px-3 py-2 text-base focus:border-primary focus:outline-none sm:text-sm"
        />
      </div>
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
          {sending ? 'Sending…' : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}
