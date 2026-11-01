import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { adminKeys, errorMessage, useAdminRpc } from '@/features/admin/api';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const keys = {
  runs: [...adminKeys.all, 'deadline-runs'] as const,
  changes: [...adminKeys.all, 'deadline-changes'] as const,
  sources: [...adminKeys.all, 'deadline-sources'] as const,
};

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  courses_fetched: number;
  checked: number;
  verified: number;
  updated: number;
  flagged: number;
  auto_linked: number;
  error: string | null;
}

interface Intake {
  id: string;
  season: string;
  academic_year: string;
  application_end: string | null;
}

interface DeadlineChange {
  id: string;
  program_id: string;
  intake_id: string | null;
  action: 'applied' | 'flagged';
  old_end: string | null;
  new_end: string | null;
  reason: string | null;
  raw: string | null;
  created_at: string;
  programs: { name: string; program_intakes: Intake[] } | null;
}

interface SourceRow {
  id: string;
  name: string;
  state: string;
  program_sources: {
    source: 'daad' | 'hochschulkompass';
    external_id: string | null;
    url: string | null;
    matched_by: string;
    last_status: string | null;
    last_checked_at: string | null;
  }[];
}

const inputClass =
  'rounded-md border border-border bg-surface px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const intakeName = (i: Intake) =>
  `${i.season === 'winter' ? 'Winter' : 'Summer'} ${i.academic_year}${i.application_end ? ` · ends ${formatDate(i.application_end)}` : ''}`;

const STATUS_TEXT: Record<string, string> = {
  ok: 'Verified',
  changed: 'Updated',
  flagged: 'Needs review',
  unparsed: 'Free text',
  no_deadline: 'No deadline listed',
  missing: 'Not on DAAD',
};

export function DeadlinesAdminPage() {
  const client = useQueryClient();
  const toast = useToast();
  const [running, setRunning] = useState(false);

  const runs = useQuery({
    queryKey: keys.runs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadline_sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as SyncRun[];
    },
  });

  const changes = useQuery({
    queryKey: keys.changes,
    queryFn: async () => {
      const columns =
        'id, program_id, intake_id, action, old_end, new_end, reason, raw, created_at, programs(name, program_intakes(id, season, academic_year, application_end))';
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [open, recent] = await Promise.all([
        supabase
          .from('deadline_changes')
          .select(columns)
          .eq('action', 'flagged')
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('deadline_changes')
          .select(columns)
          .eq('action', 'applied')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (open.error) throw open.error;
      if (recent.error) throw recent.error;
      return [...open.data, ...recent.data] as unknown as DeadlineChange[];
    },
  });

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        courses: number;
        checked: number;
        verified: number;
        updated: number;
        flagged: number;
        autoLinked: number;
      }>('deadline-sync', { body: {} });
      if (error) throw error;
      toast(
        `Checked ${data!.checked} programs against ${data!.courses} DAAD courses · ${data!.verified} verified, ${data!.updated} updated, ${data!.flagged} flagged, ${data!.autoLinked} newly linked`,
      );
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setRunning(false);
      void client.invalidateQueries({ queryKey: adminKeys.all });
    }
  };

  const last = runs.data?.[0];
  const flagged = (changes.data ?? []).filter((c) => c.action === 'flagged');
  const applied = (changes.data ?? []).filter((c) => c.action === 'applied');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Deadline sync</h1>
          <p className="max-w-2xl text-sm text-muted">
            Every 12 hours, deadlines are checked against the DAAD international programmes
            database. Matching dates are marked verified, small moves are applied automatically, and
            anything else lands here for review. Hochschulkompass blocks automated access, so its
            links are for checking by hand.
          </p>
        </div>
        <Button onClick={() => void run()} disabled={running}>
          {running ? 'Syncing… (about a minute)' : 'Sync now'}
        </Button>
      </header>

      <section className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <h2 className="font-semibold">Last run</h2>
        {!last ? (
          <p className="text-muted">Never run. Use “Sync now” or wait for the schedule.</p>
        ) : last.error ? (
          <p className="text-danger">
            {dateTime(last.started_at)} — failed: {last.error}
          </p>
        ) : !last.finished_at ? (
          <p className="text-muted">Started {dateTime(last.started_at)}, still running…</p>
        ) : (
          <p className="tabular-nums text-muted">
            {dateTime(last.finished_at)} · {last.courses_fetched} DAAD courses · {last.checked}{' '}
            linked programs checked · {last.verified} verified · {last.updated} updated ·{' '}
            {last.flagged} flagged · {last.auto_linked} newly linked
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">
            Needs review <span className="tabular-nums text-muted">· {flagged.length}</span>
          </h2>
          <p className="text-xs text-muted">
            Both buttons count as checking the program: its “Deadline not verified” badge disappears
            from the public site for 180 days. “Apply date” also changes the deadline visitors see;
            “Dismiss” / “Mark reviewed” keeps the current one. Check the official page before
            choosing.
          </p>
        </div>
        {changes.isPending ? (
          <p className="px-4 py-3 text-sm text-muted">Loading…</p>
        ) : flagged.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Nothing to review.</p>
        ) : (
          <ul className="divide-y divide-border">
            {flagged.map((c) => (
              <FlaggedRow key={c.id} change={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 font-semibold">
          Applied automatically (last 30 days){' '}
          <span className="tabular-nums text-muted">· {applied.length}</span>
        </h2>
        {applied.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No automatic changes.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {applied.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <Link
                  to={`/admin/programs/${c.program_id}`}
                  className="font-medium hover:underline"
                >
                  {c.programs?.name ?? 'Program'}
                </Link>
                <span className="tabular-nums text-muted">
                  {c.old_end && formatDate(c.old_end)} → {c.new_end && formatDate(c.new_end)} ·{' '}
                  {formatDate(c.created_at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SourceLinks />
    </div>
  );
}

function FlaggedRow({ change: c }: { change: DeadlineChange }) {
  const toast = useToast();
  const resolve = useAdminRpc<{ p_id: string; p_accept: boolean; p_intake_id: string | null }>(
    'admin_resolve_deadline_change',
  );
  const intakes = c.programs?.program_intakes ?? [];
  const [intakeId, setIntakeId] = useState(c.intake_id ?? '');

  const act = (accept: boolean) =>
    resolve.mutate(
      { p_id: c.id, p_accept: accept, p_intake_id: intakeId || null },
      {
        onSuccess: () => toast(accept ? 'Deadline applied' : 'Dismissed'),
        onError: (err) => toast(errorMessage(err)),
      },
    );

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/admin/programs/${c.program_id}`} className="font-semibold hover:underline">
          {c.programs?.name ?? 'Program'}
        </Link>
        <span className="text-xs text-muted">{dateTime(c.created_at)}</span>
      </div>
      <p>{c.reason}</p>
      {c.raw && (
        <blockquote className="border-l-2 border-border pl-3 text-muted">{c.raw}</blockquote>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {c.new_end && (
          <>
            <span className="font-medium tabular-nums">DAAD: {formatDate(c.new_end)}</span>
            <select
              aria-label="Intake to update"
              value={intakeId}
              onChange={(e) => setIntakeId(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1"
            >
              <option value="">Choose intake…</option>
              {intakes.map((i) => (
                <option key={i.id} value={i.id}>
                  {intakeName(i)}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => act(true)} disabled={resolve.isPending || !intakeId}>
              Apply date
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => act(false)}
          disabled={resolve.isPending}
        >
          {c.new_end ? 'Dismiss' : 'Mark reviewed'}
        </Button>
        {intakes.length === 0 && (
          <span className="text-xs text-muted">Add an intake in the program editor first.</span>
        )}
      </div>
    </li>
  );
}

/** `https://www2.daad.de/.../detail/4722/` or `4722` → `4722`. */
function daadId(input: string): string | null {
  const m = /(?:detail\/)?(\d{2,7})\/?\s*$/.exec(input.trim());
  return m ? m[1]! : null;
}

function SourceLinks() {
  const client = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const { data, isPending } = useQuery({
    queryKey: keys.sources,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select(
          'id, name, state, program_sources(source, external_id, url, matched_by, last_status, last_checked_at)',
        )
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return data as SourceRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: {
      programId: string;
      source: 'daad' | 'hochschulkompass';
      value: string;
    }) => {
      const value = v.value.trim();
      if (!value) {
        const { error } = await supabase
          .from('program_sources')
          .delete()
          .eq('program_id', v.programId)
          .eq('source', v.source);
        if (error) throw error;
        return;
      }
      let row: Record<string, unknown>;
      if (v.source === 'daad') {
        const id = daadId(value);
        if (!id) throw new Error('Enter a DAAD course number or detail-page link');
        row = {
          external_id: id,
          url: `https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/${id}/`,
          auto_sync: true,
        };
      } else {
        if (!/^https:\/\/(www\.)?hochschulkompass\.de\//.test(value)) {
          throw new Error('Enter a hochschulkompass.de link');
        }
        row = { url: value, external_id: null, auto_sync: false };
      }
      const { error } = await supabase.from('program_sources').upsert(
        {
          program_id: v.programId,
          source: v.source,
          matched_by: 'manual',
          last_status: null,
          last_raw: null,
          last_parsed_end: null,
          ...row,
        },
        { onConflict: 'program_id,source' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast('Saved');
      void client.invalidateQueries({ queryKey: keys.sources });
    },
    onError: (err) => toast(errorMessage(err)),
  });

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [data, filter]);
  const linked = (data ?? []).filter((p) =>
    p.program_sources.some((s) => s.source === 'daad'),
  ).length;

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">Official source links</h2>
          <p className="text-xs text-muted">
            {linked} of {data?.length ?? 0} programs linked to DAAD. The sync links exact name
            matches by itself; paste a DAAD course number or link for the rest. Clear a field to
            unlink.
          </p>
        </div>
        <input
          type="search"
          aria-label="Filter programs"
          placeholder="Filter programs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${inputClass} w-56`}
        />
      </div>
      {isPending ? (
        <p className="px-4 py-3 text-sm text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Program</th>
                <th className="px-4 py-2 font-medium">DAAD course</th>
                <th className="px-4 py-2 font-medium">Last check</th>
                <th className="px-4 py-2 font-medium">Hochschulkompass link (manual)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const daad = p.program_sources.find((s) => s.source === 'daad');
                const hk = p.program_sources.find((s) => s.source === 'hochschulkompass');
                return (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="px-4 py-2">
                      <Link to={`/admin/programs/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      {p.state === 'draft' && (
                        <span className="ml-1 text-xs text-muted">(draft)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <SourceInput
                        initial={daad?.external_id ?? ''}
                        placeholder="e.g. 4722"
                        onSave={(value) => save.mutate({ programId: p.id, source: 'daad', value })}
                      />
                      {daad?.url && (
                        <a
                          href={daad.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted hover:underline"
                        >
                          Open on DAAD{daad.matched_by === 'auto' ? ' · auto-linked' : ''}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted">
                      {daad?.last_checked_at ? (
                        <>
                          {STATUS_TEXT[daad.last_status ?? ''] ?? '—'}
                          <br />
                          {dateTime(daad.last_checked_at)}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <SourceInput
                        initial={hk?.url ?? ''}
                        placeholder="https://www.hochschulkompass.de/…"
                        onSave={(value) =>
                          save.mutate({ programId: p.id, source: 'hochschulkompass', value })
                        }
                      />
                      {hk?.url && (
                        <a
                          href={hk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SourceInput({
  initial,
  placeholder,
  onSave,
}: {
  initial: string;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() !== initial && onSave(value)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`${inputClass} min-w-40`}
    />
  );
}
