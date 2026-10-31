import { countWords, letterText } from '@flyms/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';
import { useSopStore } from '@/stores/sop';

export const SOP_DISCLAIMER =
  'This is a starting draft built from your answers. Personalise it and check each university’s requirements before submitting.';

export function SopHomePage() {
  const draftMap = useSopStore((s) => s.drafts);
  const deleteDraft = useSopStore((s) => s.deleteDraft);
  const [confirm, setConfirm] = useState<string | null>(null);
  const sorted = useMemo(
    () => Object.values(draftMap).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [draftMap],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">SOP writer</h1>
          <p className="mt-1 max-w-xl text-muted">
            Answer a few questions about your studies and experience, and get a first draft of your
            Statement of Purpose written for your field and specialization.
          </p>
        </div>
        <Link
          to="/sop/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-contrast hover:bg-primary/90"
        >
          New SOP
        </Link>
      </header>

      <ul className="grid gap-2 text-sm text-muted sm:grid-cols-3">
        <li className="rounded-md bg-surface p-3">
          <strong className="block text-text">Your facts only</strong>
          The draft uses what you tell it. Missing details become [placeholders] for you to fill.
        </li>
        <li className="rounded-md bg-surface p-3">
          <strong className="block text-text">Edit section by section</strong>
          Rewrite any part, check hints, then export to Word or PDF.
        </li>
        <li className="rounded-md bg-surface p-3">
          <strong className="block text-text">Private</strong>
          Drafts stay in this browser. Your answers are not stored on our servers.
        </li>
      </ul>

      {sorted.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          action={
            <Link to="/sop/new" className="font-semibold text-primary hover:underline">
              Start your first SOP
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="drafts" className="flex flex-col gap-3">
          <h2 id="drafts" className="text-lg font-semibold">
            Your drafts
          </h2>
          <ul className="flex flex-col gap-2">
            {sorted.map((d) => {
              const words = countWords(letterText(d.sections));
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4"
                >
                  <Link
                    to={d.sections.length ? `/sop/${d.id}` : `/sop/new?draft=${d.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate font-semibold hover:underline">
                      {d.programName ?? `General letter — ${d.specializationName || d.fieldName}`}
                    </p>
                    <p className="text-sm text-muted">
                      {d.specializationName || d.fieldName} ·{' '}
                      {d.sections.length ? `${words} words` : 'Not generated yet'} · edited{' '}
                      {formatDate(d.updatedAt.slice(0, 10))}
                    </p>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(d.id)}>
                    Delete
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            Drafts are saved only on this device. Export them to keep a copy.
          </p>
        </section>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this draft?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm) deleteDraft(confirm);
                setConfirm(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm">The draft and all its versions will be removed from this browser.</p>
      </Dialog>
    </div>
  );
}
