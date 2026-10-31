import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { adminKeys, errorMessage } from './api';

interface LinkStatus {
  program_id: string;
  url: string;
  http_status: number | null;
  checked_at: string;
  program_name: string;
}

/** Programs whose latest link check failed, with a button to run the checker now. */
export function BrokenLinks() {
  const client = useQueryClient();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: [...adminKeys.all, 'broken-links'],
    queryFn: async () => {
      const [broken, last] = await Promise.all([
        supabase
          .from('v_link_status')
          .select('*')
          .eq('ok', false)
          .order('checked_at', { ascending: false }),
        supabase
          .from('link_checks')
          .select('checked_at')
          .order('checked_at', { ascending: false })
          .limit(1),
      ]);
      if (broken.error) throw broken.error;
      return {
        rows: broken.data as LinkStatus[],
        lastRun: last.data?.[0]?.checked_at as string | undefined,
      };
    },
  });

  const run = async () => {
    setRunning(true);
    try {
      const { data: result, error } = await supabase.functions.invoke<{
        checked: number;
        failed: number;
      }>('link-checker', { body: {} });
      if (error) throw error;
      toast(`Checked ${result!.checked} links · ${result!.failed} broken`);
      void client.invalidateQueries({ queryKey: [...adminKeys.all, 'broken-links'] });
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">Broken links</h2>
          <p className="text-xs text-muted">
            {data?.lastRun
              ? `Last check ${formatDate(data.lastRun.slice(0, 10))}`
              : 'Never checked'}{' '}
            · runs weekly when scheduled
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void run()} disabled={running}>
          {running ? 'Checking… (can take a minute)' : 'Check links now'}
        </Button>
      </div>
      {isPending ? (
        <p className="px-4 py-3 text-sm text-muted">Loading…</p>
      ) : data!.rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No broken links found.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data!.rows.map((r) => (
            <li
              key={`${r.program_id}-${r.url}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <Link
                  to={`/admin/programs/${r.program_id}`}
                  className="font-medium hover:underline"
                >
                  {r.program_name}
                </Link>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-muted hover:underline"
                >
                  {r.url}
                </a>
              </div>
              <span className="rounded-sm bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                {r.http_status ?? 'No response'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
