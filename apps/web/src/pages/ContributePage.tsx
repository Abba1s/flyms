import { changeRequestSchema, degreeTypes, type ChangeRequestInput } from '@flyms/shared';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input, Select } from '@/components/ui/Input';
import { useFields, usePrograms } from '@/features/programs/api';
import { fieldErrors, submitPublic } from '@/features/submit/api';
import { useTurnstile } from '@/features/submit/Turnstile';

type Mode = 'new_program' | 'update_program';

const EMPTY = {
  university_name: '',
  name: '',
  field_slug: '',
  degree_type: '',
  teaching_language: '',
  official_url: '',
  application_url: '',
  intake_season: '',
  application_start: '',
  application_end: '',
  ielts_min: '',
  tuition_fee_eur: '',
};
type ProposalForm = typeof EMPTY;

export function ContributePage() {
  const [params] = useSearchParams();
  const { programs } = usePrograms();
  const { data: fields = [] } = useFields();
  const [mode, setMode] = useState<Mode>(params.get('program') ? 'update_program' : 'new_program');
  const [programId, setProgramId] = useState(params.get('program') ?? '');
  const [programQuery, setProgramQuery] = useState('');
  const [form, setForm] = useState<ProposalForm>(EMPTY);
  const [note, setNote] = useState('');
  const [submitter, setSubmitter] = useState({
    submitter_name: '',
    submitter_email: '',
    submitter_phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const turnstile = useTurnstile();

  const selected = programs.find((p) => p.id === programId);
  const matches = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return programs
      .filter((p) => `${p.name} ${p.university_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [programs, programQuery]);

  const set =
    (key: keyof ProposalForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  const err = (key: string) => errors[`proposal.${key}`] ?? errors[key];

  const build = (): unknown => {
    // Updates send only the fields the contributor filled in; new programs send the whole form
    // so required fields get their own error messages.
    const proposal = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    return mode === 'new_program'
      ? { type: mode, proposal: form, note, ...submitter }
      : { type: mode, program_id: programId, proposal, note, ...submitter };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'update_program' && !programId) {
      setErrors({ program_id: 'Choose the program you want to update' });
      return;
    }
    const parsed = changeRequestSchema.safeParse(build());
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFailure('Please check the highlighted fields.');
      // Move focus to the first invalid field once it has re-rendered.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setErrors({});
    setFailure(null);
    setSending(true);
    try {
      const token = await turnstile.getToken();
      await submitPublic(
        { kind: 'change_request', data: parsed.data as ChangeRequestInput },
        token,
      );
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Something went wrong.');
      turnstile.reset();
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold">Thank you!</h1>
        <p className="text-muted">
          An admin will review your suggestion before it goes live. This usually takes a few days.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setDone(false);
              setForm(EMPTY);
              setNote('');
              turnstile.reset();
            }}
          >
            Suggest another
          </Button>
          <Link
            to="/explore"
            className="inline-flex h-10 items-center px-4 text-sm font-semibold text-primary"
          >
            Back to programs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Contribute</h1>
        <p className="mt-1 text-muted">
          Suggest a program or correct one. No account needed — an admin reviews every suggestion
          before it goes live.
        </p>
      </header>

      <div role="radiogroup" aria-label="What would you like to do?" className="flex gap-2">
        <Chip
          role="radio"
          aria-checked={mode === 'new_program'}
          aria-pressed={undefined}
          selected={mode === 'new_program'}
          onClick={() => setMode('new_program')}
        >
          Add a new program
        </Chip>
        <Chip
          role="radio"
          aria-checked={mode === 'update_program'}
          aria-pressed={undefined}
          selected={mode === 'update_program'}
          onClick={() => setMode('update_program')}
        >
          Update an existing one
        </Chip>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {mode === 'update_program' && (
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Which program?</h2>
            {selected ? (
              <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-sm text-muted">{selected.university_name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setProgramId('')}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  label="Search programs"
                  value={programQuery}
                  onChange={(e) => setProgramQuery(e.target.value)}
                  placeholder="Program or university name"
                  error={errors.program_id}
                />
                {matches.length > 0 && (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setProgramId(p.id)}
                          className="w-full px-3 py-2 text-left hover:bg-surface-2"
                        >
                          <span className="block font-medium">{p.name}</span>
                          <span className="block text-sm text-muted">{p.university_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="note" className="text-sm font-medium">
                What changed?
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                aria-invalid={errors.note ? true : undefined}
                placeholder="e.g. The summer deadline is now 15 January. Source: official page."
                className="rounded-sm border border-border bg-surface px-3 py-2 text-base placeholder:text-muted focus:border-primary focus:outline-none sm:text-sm"
              />
              {errors.note && <p className="text-xs text-danger">{errors.note}</p>}
            </div>
            <p className="text-sm text-muted">Fill in only the fields that changed below.</p>
          </section>
        )}

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Program details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="University"
              value={form.university_name}
              onChange={set('university_name')}
              error={err('university_name')}
              required={mode === 'new_program'}
            />
            <Input
              label="Program name"
              value={form.name}
              onChange={set('name')}
              placeholder="M.Sc. Data Science"
              error={err('name')}
              required={mode === 'new_program'}
            />
            <Select label="Field" value={form.field_slug} onChange={set('field_slug')}>
              <option value="">Not sure</option>
              {fields.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select label="Degree" value={form.degree_type} onChange={set('degree_type')}>
              <option value="">Not sure</option>
              {degreeTypes.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Select
              label="Teaching language"
              value={form.teaching_language}
              onChange={set('teaching_language')}
            >
              <option value="">Not sure</option>
              <option value="english">English</option>
              <option value="german">German</option>
              <option value="english_german">English & German</option>
            </Select>
            <Select label="Intake" value={form.intake_season} onChange={set('intake_season')}>
              <option value="">Not sure</option>
              <option value="winter">Winter</option>
              <option value="summer">Summer</option>
            </Select>
            <Input
              label="Applications open"
              type="date"
              value={form.application_start}
              onChange={set('application_start')}
              error={err('application_start')}
            />
            <Input
              label="Deadline"
              type="date"
              value={form.application_end}
              onChange={set('application_end')}
              error={err('application_end')}
            />
            <Input
              label="Minimum IELTS"
              type="number"
              step="0.5"
              min="0"
              max="9"
              inputMode="decimal"
              value={form.ielts_min}
              onChange={set('ielts_min')}
              error={err('ielts_min')}
            />
            <Input
              label="Tuition per semester (€)"
              type="number"
              min="0"
              inputMode="numeric"
              value={form.tuition_fee_eur}
              onChange={set('tuition_fee_eur')}
              hint="0 if there is none"
              error={err('tuition_fee_eur')}
            />
          </div>
          <Input
            label="Official program page"
            type="url"
            value={form.official_url}
            onChange={set('official_url')}
            placeholder="https://"
            error={err('official_url')}
            required={mode === 'new_program'}
          />
          <Input
            label="Application link (optional)"
            type="url"
            value={form.application_url}
            onChange={set('application_url')}
            placeholder="https://"
            error={err('application_url')}
          />
          {mode === 'new_program' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-note" className="text-sm font-medium">
                Anything else? <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="new-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                className="rounded-sm border border-border bg-surface px-3 py-2 text-base focus:border-primary focus:outline-none sm:text-sm"
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">About you</h2>
          <p className="-mt-2 text-sm text-muted">
            Only admins see this, in case they need to ask about your suggestion.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Your name"
              autoComplete="name"
              value={submitter.submitter_name}
              onChange={(e) => setSubmitter((s) => ({ ...s, submitter_name: e.target.value }))}
              error={errors.submitter_name}
              required
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={submitter.submitter_email}
              onChange={(e) => setSubmitter((s) => ({ ...s, submitter_email: e.target.value }))}
              error={errors.submitter_email}
              required
            />
            <Input
              label="Phone / WhatsApp (optional)"
              type="tel"
              autoComplete="tel"
              value={submitter.submitter_phone}
              onChange={(e) => setSubmitter((s) => ({ ...s, submitter_phone: e.target.value }))}
            />
          </div>
        </section>

        {turnstile.widget}
        {failure && (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        )}
        <Button type="submit" disabled={sending} className="self-start">
          {sending ? 'Sending…' : 'Send suggestion'}
        </Button>
      </form>
    </div>
  );
}
