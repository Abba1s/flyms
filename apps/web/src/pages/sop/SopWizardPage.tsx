import {
  SOP_ANSWER_MAX,
  SOP_ANSWERS_TOTAL_MAX,
  SOP_LENGTHS,
  SOP_TEMPLATES,
  missingRequired,
  type SopLength,
  type SopTemplateId,
} from '@flyms/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { AutoTextarea } from '@/features/sop/AutoTextarea';
import { useFields, usePrograms, useSpecializations } from '@/features/programs/api';
import { cn } from '@/lib/cn';
import { useLocalStore } from '@/stores/local';
import { useSopStore } from '@/stores/sop';
import { SOP_DISCLAIMER } from './SopHomePage';

const STEPS = ['Field', 'Specialization', 'Program', 'About you', 'Review'] as const;

export function SopWizardPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: fields = [] } = useFields();
  const { data: specializations = [] } = useSpecializations();
  const { programs } = usePrograms();
  const saved = useLocalStore((s) => s.saved);
  const { drafts, createDraft, updateDraft } = useSopStore();

  const draftId = params.get('draft');
  const draft = draftId ? drafts[draftId] : undefined;
  const step = Math.min(Math.max(Number(params.get('step') ?? '1'), 1), 5);

  // Local working state; written to the draft as the visitor moves between steps.
  const [fieldSlug, setFieldSlug] = useState(draft?.fieldSlug ?? '');
  const [specSlug, setSpecSlug] = useState(draft?.specializationSlug ?? '');
  const [programId, setProgramId] = useState<string | null>(draft?.programId ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(draft?.answers ?? {});
  const [length, setLength] = useState<SopLength>(draft?.length ?? 'standard');
  const [programQuery, setProgramQuery] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  // Prefill from ?program= (entry from a program page or the map).
  const prefillId = params.get('program');
  useEffect(() => {
    if (!prefillId || draftId || programs.length === 0) return;
    const p = programs.find((x) => x.id === prefillId);
    if (!p) return;
    setFieldSlug(p.field_slug);
    setSpecSlug(p.specialization_slugs[0] ?? '');
    setProgramId(p.id);
    setParams({ step: '4' }, { replace: true });
  }, [prefillId, draftId, programs, setParams]);

  const field = fields.find((f) => f.slug === fieldSlug);
  const template = field ? SOP_TEMPLATES[field.sop_template as SopTemplateId] : undefined;
  const spec = specializations.find((s) => s.slug === specSlug);
  const program = programs.find((p) => p.id === programId);
  const fieldSpecs = specializations.filter((s) => s.field_id === field?.id);
  const specProgramCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of programs) for (const s of p.specialization_slugs) m.set(s, (m.get(s) ?? 0) + 1);
    return m;
  }, [programs]);

  const savedIds = new Set(saved.map((s) => s.id));
  const programOptions = useMemo(() => {
    const q = programQuery.trim().toLowerCase();
    const inField = programs.filter((p) => p.field_slug === fieldSlug);
    const filtered = q
      ? programs.filter((p) => `${p.name} ${p.university_name}`.toLowerCase().includes(q))
      : inField.filter((p) => savedIds.has(p.id) || p.specialization_slugs.includes(specSlug));
    return [...filtered]
      .sort((a, b) => Number(savedIds.has(b.id)) - Number(savedIds.has(a.id)))
      .slice(0, 12);
    // savedIds is derived from saved
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs, programQuery, fieldSlug, specSlug, saved]);

  const missing = template ? missingRequired(template, answers) : [];
  const totalChars = Object.values(answers).reduce((n, v) => n + v.length, 0);

  const canContinue: Record<number, boolean> = {
    1: Boolean(field),
    2: Boolean(spec),
    3: true,
    4: missing.length === 0 && totalChars <= SOP_ANSWERS_TOTAL_MAX,
    5: true,
  };

  /** Persist progress, creating the draft on first save. Returns the draft id. */
  const save = (): string | null => {
    if (!field || !template) return null;
    const data = {
      template: template.id,
      fieldSlug: field.slug,
      fieldName: field.name,
      specializationSlug: spec?.slug ?? '',
      specializationName: spec?.name ?? '',
      programId: program?.id ?? null,
      programName: program ? `${program.name} — ${program.university_name}` : null,
      answers,
      length,
    };
    if (draftId && drafts[draftId]) {
      updateDraft(draftId, data);
      return draftId;
    }
    return createDraft(data);
  };

  const go = (target: number) => {
    const id = save();
    if (!id) return;
    setShowErrors(false);
    setParams({ draft: id, step: String(target) });
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    if (!canContinue[step]) {
      setShowErrors(true);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (step < 5) go(step + 1);
  };

  const generate = () => {
    const id = save();
    if (id) navigate(`/sop/${id}?generate=1`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <header className="flex flex-col gap-3">
        <Link to="/sop" className="text-sm text-muted hover:underline">
          ← SOP writer
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New Statement of Purpose</h1>
        <ol className="flex gap-1" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <div
                className={cn('h-1.5 rounded-full', i + 1 <= step ? 'bg-primary' : 'bg-border')}
              />
              <span
                className={cn(
                  'mt-1 hidden text-xs sm:block',
                  i + 1 === step ? 'font-semibold text-text' : 'text-muted',
                )}
                aria-current={i + 1 === step ? 'step' : undefined}
              >
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted sm:hidden">
          Step {step} of 5 · {STEPS[step - 1]}
        </p>
      </header>

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Which field are you applying in?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <button
                key={f.slug}
                type="button"
                aria-pressed={fieldSlug === f.slug}
                onClick={() => {
                  setFieldSlug(f.slug);
                  setSpecSlug('');
                }}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-l-4 bg-surface p-3 text-left font-medium',
                  fieldSlug === f.slug
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:bg-surface-2',
                )}
                style={{ borderLeftColor: f.color }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && field && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Which specialization in {field.name}?</h2>
          <div className="flex flex-wrap gap-2">
            {fieldSpecs.map((s) => (
              <Chip key={s.slug} selected={specSlug === s.slug} onClick={() => setSpecSlug(s.slug)}>
                {s.name}
                {(specProgramCount.get(s.slug) ?? 0) > 0 && (
                  <span className="text-xs opacity-70">
                    {specProgramCount.get(s.slug)} programs
                  </span>
                )}
              </Chip>
            ))}
          </div>
          {showErrors && !spec && <p className="text-sm text-danger">Choose a specialization.</p>}
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Is this for a specific program?</h2>
          <p className="-mt-2 text-sm text-muted">
            Choosing one lets the draft mention its modules and features. You can also write a
            general letter and adapt it later.
          </p>
          <button
            type="button"
            aria-pressed={programId === null}
            onClick={() => setProgramId(null)}
            className={cn(
              'rounded-lg border bg-surface p-3 text-left',
              programId === null
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border hover:bg-surface-2',
            )}
          >
            <span className="font-semibold">General letter</span>
            <span className="block text-sm text-muted">
              No specific university — I’ll tailor it later.
            </span>
          </button>
          <input
            type="search"
            value={programQuery}
            onChange={(e) => setProgramQuery(e.target.value)}
            placeholder="Search any program or university"
            aria-label="Search programs"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
          <ul className="flex flex-col gap-2">
            {programOptions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={programId === p.id}
                  onClick={() => setProgramId(p.id)}
                  className={cn(
                    'w-full rounded-lg border bg-surface p-3 text-left',
                    programId === p.id
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border hover:bg-surface-2',
                  )}
                >
                  <span className="font-semibold">{p.name}</span>
                  {savedIds.has(p.id) && (
                    <span className="ml-2 text-xs font-semibold text-primary">In My List</span>
                  )}
                  <span className="block text-sm text-muted">{p.university_name}</span>
                </button>
              </li>
            ))}
            {programOptions.length === 0 && (
              <li className="text-sm text-muted">
                No matching programs. Try a search, or write a general letter.
              </li>
            )}
          </ul>
        </section>
      )}

      {step === 4 && template && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">About you</h2>
            <p className="text-sm text-muted">
              Short, factual answers work best. The draft will only use what you write here.
            </p>
          </div>
          {template.questions.map((q) => {
            const value = answers[q.id] ?? '';
            const invalid = showErrors && missing.includes(q.id);
            return (
              <div key={q.id} className="flex flex-col gap-1.5">
                <label htmlFor={`q-${q.id}`} className="font-medium">
                  {q.label}
                  {q.required && (
                    <span className="text-danger" aria-hidden>
                      {' '}
                      *
                    </span>
                  )}
                </label>
                <p id={`q-${q.id}-help`} className="text-sm text-muted">
                  {q.help}
                </p>
                <AutoTextarea
                  id={`q-${q.id}`}
                  value={value}
                  rows={q.multiline ? 3 : 1}
                  maxLength={SOP_ANSWER_MAX}
                  placeholder={`e.g. ${q.example}`}
                  aria-invalid={invalid ? true : undefined}
                  aria-describedby={`q-${q.id}-help`}
                  aria-required={q.required}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  className={cn(
                    'rounded-md border bg-surface px-3 py-2 text-base placeholder:text-muted/70 focus:border-primary focus:outline-none sm:text-sm',
                    invalid ? 'border-danger' : 'border-border',
                  )}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-danger">
                    {invalid ? 'This answer is needed for a good draft.' : ''}
                  </span>
                  {value.length > SOP_ANSWER_MAX * 0.8 && (
                    <span className="tabular-nums text-muted">
                      {value.length}/{SOP_ANSWER_MAX}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <p
            className={cn(
              'text-sm tabular-nums',
              totalChars > SOP_ANSWERS_TOTAL_MAX ? 'text-danger' : 'text-muted',
            )}
          >
            {totalChars.toLocaleString('en-GB')} / {SOP_ANSWERS_TOTAL_MAX.toLocaleString('en-GB')}{' '}
            characters in total
          </p>
        </section>
      )}

      {step === 5 && template && (
        <section className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold">Review</h2>
          <dl className="grid gap-2 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted">Field</dt>
            <dd>{field?.name}</dd>
            <dt className="text-muted">Specialization</dt>
            <dd>{spec?.name}</dd>
            <dt className="text-muted">Program</dt>
            <dd>{program ? `${program.name} — ${program.university_name}` : 'General letter'}</dd>
            <dt className="text-muted">Answers</dt>
            <dd>
              {Object.values(answers).filter((v) => v.trim()).length} of {template.questions.length}{' '}
              ·{' '}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => go(4)}
              >
                Edit
              </button>
            </dd>
          </dl>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Length</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SOP_LENGTHS) as SopLength[]).map((l) => (
                <Chip
                  key={l}
                  role="radio"
                  aria-checked={length === l}
                  aria-pressed={undefined}
                  selected={length === l}
                  onClick={() => setLength(l)}
                >
                  {l[0]!.toUpperCase() + l.slice(1)} · ~{SOP_LENGTHS[l]} words
                </Chip>
              ))}
            </div>
          </fieldset>
          <p className="rounded-md bg-surface-2 px-4 py-3 text-sm">{SOP_DISCLAIMER}</p>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 flex justify-between gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-60">
        <Button variant="ghost" disabled={step === 1} onClick={() => go(step - 1)}>
          Back
        </Button>
        {step < 5 ? (
          <Button onClick={next} disabled={step === 1 && !field}>
            Continue
          </Button>
        ) : (
          <Button onClick={generate}>Generate draft</Button>
        )}
      </div>
    </div>
  );
}
