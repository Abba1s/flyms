import {
  PLACEHOLDER_RE,
  SOP_LENGTHS,
  countWords,
  letterText,
  sopHints,
  type SopRewriteInstruction,
  type SopSectionId,
  type SopStreamEvent,
} from '@flyms/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { AutoTextarea } from '@/features/sop/AutoTextarea';
import { copyLetter, downloadDocx, downloadPdf } from '@/features/sop/exports';
import { streamSop } from '@/features/sop/stream';
import { useTurnstile } from '@/features/submit/Turnstile';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useSopStore, type SopDraft, type SopSection } from '@/stores/sop';
import { SOP_DISCLAIMER } from './SopHomePage';

const REWRITES: { id: SopRewriteInstruction; label: string }[] = [
  { id: 'regenerate', label: 'Regenerate' },
  { id: 'specific', label: 'More specific' },
  { id: 'shorter', label: 'Shorter' },
  { id: 'formal', label: 'More formal' },
];

type Busy = { kind: 'all' } | { kind: 'section'; id: SopSectionId } | null;
type RunResult = 'ok' | 'failed' | 'stopped' | 'unmounted';

function contextBody(d: SopDraft) {
  return {
    template: d.template,
    fieldName: d.fieldName,
    specializationName: d.specializationName,
    programId: d.programId,
    answers: Object.fromEntries(Object.entries(d.answers).filter(([, v]) => v.trim())),
  };
}

export function SopEditorPage() {
  const { draftId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const draft = useSopStore((s) => s.drafts[draftId]);
  const { updateDraft, setSectionText, saveVersion, restoreVersion } = useSopStore();
  const turnstile = useTurnstile();

  const [busy, setBusy] = useState<Busy>(null);
  /** Text streamed so far; committed to the draft when the stream ends. */
  const [live, setLive] = useState<SopSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportConfirm, setExportConfirm] = useState<null | (() => Promise<void>)>(null);
  const [panel, setPanel] = useState<'hints' | 'versions'>('hints');
  const abortRef = useRef<AbortController | null>(null);
  const textareas = useRef<Partial<Record<SopSectionId, HTMLTextAreaElement | null>>>({});

  const sections = useMemo(() => live ?? draft?.sections ?? [], [live, draft?.sections]);
  const words = countWords(letterText(sections));
  const target = draft ? SOP_LENGTHS[draft.length] : 900;
  const hints = useMemo(() => (busy ? [] : sopHints(sections)), [sections, busy]);
  const placeholders = (letterText(sections).match(PLACEHOLDER_RE) ?? []).length;

  // Leaving the page cancels any running generation (and its cost).
  useEffect(() => () => abortRef.current?.abort('unmount'), []);

  /**
   * Run one streamed request. Resolves to 'stopped' when the visitor pressed Stop and to
   * 'unmounted' when the page went away — in that case no state may be touched.
   */
  const run = useCallback(
    async (
      kind: Busy,
      fn: 'sop-generate' | 'sop-rewrite',
      body: Record<string, unknown>,
      onEvent: (e: SopStreamEvent) => void,
    ): Promise<RunResult> => {
      setBusy(kind);
      setError(null);
      const abort = new AbortController();
      abortRef.current = abort;
      const outcome = (): RunResult =>
        abort.signal.reason === 'unmount' ? 'unmounted' : 'stopped';
      try {
        const token = await turnstile.getToken();
        if (abort.signal.aborted) return outcome();
        let failed = false;
        await streamSop(
          fn,
          { ...body, turnstileToken: token },
          (e) => {
            if (abort.signal.aborted) return;
            if (e.type === 'error') {
              failed = true;
              setError(e.message);
            } else onEvent(e);
          },
          abort.signal,
        );
        return failed ? 'failed' : 'ok';
      } catch (err) {
        if (abort.signal.aborted) return outcome();
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        return 'failed';
      } finally {
        if (abort.signal.reason !== 'unmount') {
          turnstile.reset();
          setBusy(null);
        }
        if (abortRef.current === abort) abortRef.current = null;
      }
    },
    [turnstile],
  );

  const generateAll = useCallback(async (): Promise<RunResult> => {
    if (!draft) return 'failed';
    if (draft.sections.length) saveVersion(draft.id, 'Before regenerating');
    let acc: SopSection[] = [];
    setLive([]);
    const result = await run(
      { kind: 'all' },
      'sop-generate',
      { ...contextBody(draft), length: draft.length },
      (e) => {
        if (e.type === 'restart') acc = [];
        else if (e.type === 'section') acc = [...acc, { id: e.id, title: e.title, text: '' }];
        else if (e.type === 'delta')
          acc = acc.map((s) => (s.id === e.id ? { ...s, text: s.text + e.text } : s));
        setLive(acc);
      },
    );
    if (result === 'unmounted') return result;
    const cleaned = acc.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text);
    if (result === 'ok' && cleaned.length) {
      updateDraft(draft.id, { sections: cleaned });
      saveVersion(draft.id, 'Generated');
      track('SOP Generate', { template: draft.template });
    } else if (cleaned.length && !draft.sections.length) {
      // Keep partial text from a stopped or failed first generation rather than losing it.
      updateDraft(draft.id, { sections: cleaned });
    }
    setLive(null);
    return result;
  }, [draft, run, saveVersion, updateDraft]);

  const rewrite = async (section: SopSection, instruction: SopRewriteInstruction) => {
    if (!draft) return;
    saveVersion(
      draft.id,
      `Before “${REWRITES.find((r) => r.id === instruction)!.label}” on ${section.title}`,
    );
    let text = '';
    setLive(draft.sections);
    const result = await run(
      { kind: 'section', id: section.id },
      'sop-rewrite',
      { ...contextBody(draft), sectionId: section.id, sectionText: section.text, instruction },
      (e) => {
        if (e.type === 'restart') text = '';
        if (e.type === 'delta') text += e.text;
        setLive(draft.sections.map((s) => (s.id === section.id ? { ...s, text } : s)));
      },
    );
    if (result === 'unmounted') return;
    if (result === 'ok' && text.trim()) setSectionText(draft.id, section.id, text.trim());
    setLive(null);
  };

  // Auto-start after the wizard (?generate=1). Re-arms if the page remounts mid-run.
  const generateRef = useRef(generateAll);
  generateRef.current = generateAll;
  const started = useRef(false);
  const hasDraft = Boolean(draft);
  useEffect(() => {
    if (!hasDraft || started.current || params.get('generate') !== '1') return;
    started.current = true;
    void generateRef.current().then((r) => {
      if (r !== 'unmounted') setParams({}, { replace: true });
    });
    return () => {
      started.current = false;
    };
  }, [hasDraft, params, setParams]);

  const jumpTo = (sectionId: SopSectionId | null, match?: string) => {
    const target = sectionId
      ? textareas.current[sectionId]
      : Object.values(textareas.current).find(
          (t) => t && match && t.value.toLowerCase().includes(match),
        );
    if (!target) return;
    target.focus();
    if (match) {
      const i = target.value.toLowerCase().indexOf(match.toLowerCase());
      if (i >= 0) target.setSelectionRange(i, i + match.length);
    }
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const exportWith = (fn: (d: SopDraft) => Promise<void>, done: string) => {
    if (!draft) return;
    const go = async () => {
      try {
        await fn(draft);
        track('SOP Export');
        toast(done);
      } catch {
        toast('Export failed. Please try again.');
      }
    };
    if (placeholders > 0) setExportConfirm(() => go);
    else void go();
  };

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          title="Draft not found"
          action={
            <Link to="/sop" className="font-semibold text-primary hover:underline">
              Back to your drafts
            </Link>
          }
        >
          Drafts are stored in the browser where they were created.
        </EmptyState>
      </div>
    );
  }

  const title =
    draft.programName ?? `General letter — ${draft.specializationName || draft.fieldName}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link to="/sop" className="text-sm text-muted hover:underline">
            ← Your drafts
          </Link>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {busy?.kind === 'all'
              ? 'Writing your draft…'
              : `${words} / ~${target} words${placeholders ? ` · ${placeholders} placeholder${placeholders === 1 ? '' : 's'} to fill` : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/sop/new?draft=${draft.id}&step=4`)}
            disabled={busy !== null}
          >
            Edit answers
          </Button>
          {busy?.kind === 'all' ? (
            <Button variant="secondary" size="sm" onClick={() => abortRef.current?.abort('stop')}>
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => void generateAll()} disabled={busy !== null}>
              {draft.sections.length ? 'Regenerate all' : 'Generate draft'}
            </Button>
          )}
        </div>
      </header>

      {turnstile.widget}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-surface px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article aria-label="Your letter" className="flex flex-col gap-4">
          {sections.length === 0 && busy === null && (
            <EmptyState
              title="No draft yet"
              action={<Button onClick={() => void generateAll()}>Generate draft</Button>}
            >
              Your answers are saved. Generate a first draft when you are ready.
            </EmptyState>
          )}
          {sections.length === 0 && busy?.kind === 'all' && (
            <div
              className="h-40 animate-pulse rounded-lg border border-border bg-surface"
              aria-busy="true"
            />
          )}
          {sections.map((s) => {
            const rewriting = busy?.kind === 'section' && busy.id === s.id;
            const count = (s.text.match(PLACEHOLDER_RE) ?? []).length;
            return (
              <section
                key={s.id}
                className={cn(
                  'group rounded-lg border bg-surface p-4 md:p-6',
                  rewriting ? 'border-primary' : 'border-border',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {s.title}
                    {count > 0 && (
                      <span className="ml-2 rounded-sm bg-st-closing/12 px-1.5 py-0.5 normal-case tracking-normal text-st-closing">
                        {count} to fill
                      </span>
                    )}
                  </h2>
                  {busy === null && draft.sections.length > 0 && (
                    <div
                      className="flex flex-wrap gap-1"
                      role="group"
                      aria-label={`Rewrite ${s.title}`}
                    >
                      {REWRITES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => void rewrite(s, r.id)}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {rewriting && (
                    <span className="text-xs font-semibold text-primary">Rewriting…</span>
                  )}
                </div>
                <AutoTextarea
                  ref={(el) => {
                    textareas.current[s.id] = el;
                  }}
                  aria-label={s.title}
                  value={s.text}
                  readOnly={busy !== null}
                  onChange={(e) => setSectionText(draft.id, s.id, e.target.value)}
                  className="w-full bg-transparent font-serif text-[17px] leading-7 focus:outline-none"
                />
              </section>
            );
          })}
          <p className="text-xs text-muted">{SOP_DISCLAIMER}</p>
        </article>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-semibold">Export</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!draft.sections.length || busy !== null}
                onClick={() => exportWith(downloadDocx, 'Word file downloaded')}
              >
                Word (.docx)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!draft.sections.length || busy !== null}
                onClick={() => exportWith(downloadPdf, 'PDF downloaded')}
              >
                PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!draft.sections.length || busy !== null}
                onClick={() => exportWith(copyLetter, 'Copied to clipboard')}
              >
                Copy text
              </Button>
            </div>
            <p className="text-xs text-muted">
              Drafts are saved only in this browser — export to keep a copy.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <div className="flex border-b border-border" role="tablist">
              {(['hints', 'versions'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={panel === t}
                  onClick={() => setPanel(t)}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm font-semibold',
                    panel === t ? 'border-b-2 border-primary text-primary' : 'text-muted',
                  )}
                >
                  {t === 'hints'
                    ? `Hints (${hints.length})`
                    : `Versions (${draft.versions.length})`}
                </button>
              ))}
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-3" role="tabpanel">
              {panel === 'hints' &&
                (hints.length === 0 ? (
                  <p className="p-1 text-sm text-muted">
                    {draft.sections.length
                      ? 'No issues found. Read it aloud once more!'
                      : 'Hints appear after generating.'}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {hints.map((h, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => jumpTo(h.sectionId, h.match)}
                          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                        >
                          <span
                            className={cn(
                              'mr-1.5 text-xs font-semibold uppercase',
                              h.kind === 'placeholder' ? 'text-st-closing' : 'text-muted',
                            )}
                          >
                            {h.kind}
                          </span>
                          {h.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
              {panel === 'versions' &&
                (draft.versions.length === 0 ? (
                  <p className="p-1 text-sm text-muted">
                    Versions are saved automatically before each rewrite.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {draft.versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{v.label}</span>
                          <span className="text-xs text-muted">
                            {formatDate(v.createdAt.slice(0, 10))} {v.createdAt.slice(11, 16)} ·{' '}
                            {countWords(letterText(v.sections))} words
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            restoreVersion(draft.id, v.id);
                            toast('Version restored');
                          }}
                          className="shrink-0 text-xs font-semibold text-primary hover:underline"
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </section>
        </aside>
      </div>

      <Dialog
        open={exportConfirm !== null}
        onOpenChange={(o) => !o && setExportConfirm(null)}
        title="Placeholders left"
        description={`Your letter still has ${placeholders} [placeholder${placeholders === 1 ? '' : 's'}] to replace with your own details.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportConfirm(null)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                void exportConfirm?.();
                setExportConfirm(null);
              }}
            >
              Export anyway
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Admissions readers will notice unfilled brackets. Use the Hints tab to jump to each one.
        </p>
      </Dialog>
    </div>
  );
}
