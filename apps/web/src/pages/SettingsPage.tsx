import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { downloadJson } from '@/features/mylist/export';
import { track } from '@/lib/analytics';
import { promptInstall, useInstallStore } from '@/lib/pwa';
import { useTheme } from '@/lib/theme';
import {
  backupSchema,
  buildBackup,
  storageAvailable,
  useLocalStore,
  type LocalData,
} from '@/stores/local';
import { sopDraftSchema, useSopStore, type SopDraft } from '@/stores/sop';

interface PendingImport {
  data: LocalData;
  drafts: Record<string, SopDraft>;
}

/** Keep only SOP drafts that validate; a damaged entry should not block the rest. */
function validDrafts(raw: Record<string, unknown> | undefined): Record<string, SopDraft> {
  const out: Record<string, SopDraft> = {};
  for (const [id, value] of Object.entries(raw ?? {})) {
    const r = sopDraftSchema.safeParse(value);
    if (r.success) out[id] = r.data;
  }
  return out;
}

export function SettingsPage() {
  const { preference, setPreference } = useTheme();
  const store = useLocalStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const sop = useSopStore();
  const canInstall = useInstallStore((s) => s.event !== null);
  const installed = useInstallStore((s) => s.installed);
  const [confirmClear, setConfirmClear] = useState(false);

  const onFile = async (file: File) => {
    try {
      const parsed = backupSchema.parse(JSON.parse(await file.text()));
      setPending({ data: parsed.data, drafts: validDrafts(parsed.sopDrafts) });
    } catch {
      toast('That file is not a Universal Travel and Education Consultancy backup.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Theme</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map((p) => (
            <Chip
              key={p}
              role="radio"
              aria-checked={preference === p}
              aria-pressed={undefined}
              selected={preference === p}
              onClick={() => setPreference(p)}
            >
              {p === 'system' ? 'Match device' : p === 'light' ? 'Light' : 'Dark'}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Install app</h2>
        <p className="text-sm text-muted">
          {installed
            ? 'Universal Travel and Education Consultancy is installed on this device.'
            : 'Add Universal Travel and Education Consultancy to your home screen. My List, the tracker and SOP drafts then work offline.'}
        </p>
        {!installed &&
          (canInstall ? (
            <Button
              className="self-start"
              onClick={() =>
                void promptInstall().then((ok) => {
                  if (ok) track('App Install');
                })
              }
            >
              Install Universal Travel and Education Consultancy
            </Button>
          ) : (
            <p className="text-sm text-muted">
              On iPhone: tap Share, then “Add to Home Screen”. In other browsers, use the install
              icon in the address bar.
            </p>
          ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="text-sm text-muted">
          Universal Travel and Education Consultancy has no accounts. Your saved programs,
          application tracker and SOP drafts live only in this browser. Export a backup file to keep
          them safe or move them to another device.
        </p>
        {!storageAvailable && (
          <p role="alert" className="text-sm text-danger">
            This browser is blocking storage, so changes will be lost when you close the tab.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              downloadJson(
                buildBackup(
                  {
                    saved: store.saved,
                    dismissedBanners: store.dismissedBanners,
                    tracker: store.tracker,
                    compareIds: store.compareIds,
                  },
                  sop.drafts,
                ),
                `flyms-backup-${new Date().toISOString().slice(0, 10)}.json`,
              )
            }
          >
            Export backup
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Clear data</h2>
        <p className="text-sm text-muted">
          Remove all saved programs, tracker data and SOP drafts from this browser.
        </p>
        <Button variant="danger" className="self-start" onClick={() => setConfirmClear(true)}>
          Clear all data
        </Button>
      </section>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Import backup"
        description={`The file has ${pending?.data.saved.length ?? 0} saved programs and ${Object.keys(pending?.drafts ?? {}).length} SOP drafts.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                store.replaceAll(pending!.data);
                sop.replaceAll(pending!.drafts);
                setPending(null);
                toast('Backup restored');
              }}
            >
              Replace current
            </Button>
            <Button
              onClick={() => {
                store.mergeIn(pending!.data);
                sop.replaceAll({ ...pending!.drafts, ...sop.drafts });
                setPending(null);
                toast('Backup merged');
              }}
            >
              Merge
            </Button>
          </>
        }
      >
        <p className="text-sm">
          <strong>Merge</strong> keeps your current list and adds anything new.{' '}
          <strong>Replace</strong> discards your current list.
        </p>
      </Dialog>

      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all data?"
        description="This cannot be undone. Export a backup first if you might need it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                store.clearAll();
                sop.replaceAll({});
                setConfirmClear(false);
                toast('All local data cleared');
              }}
            >
              Clear data
            </Button>
          </>
        }
      >
        <p className="text-sm">You have {store.saved.length} saved programs.</p>
      </Dialog>
    </div>
  );
}
