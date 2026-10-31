import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { adminKeys, errorMessage, useAdminRpc } from '@/features/admin/api';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

interface Report {
  id: string;
  program_id: string;
  kind: string;
  message: string | null;
  reporter_email: string | null;
  created_at: string;
  programs: { name: string; official_url: string } | null;
}

export function ReportsQueuePage() {
  const toast = useToast();
  const { data: reports = [], isPending } = useQuery({
    queryKey: adminKeys.reports,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_reports')
        .select('*, programs(name, official_url)')
        .is('resolved_at', null)
        .order('created_at');
      if (error) throw error;
      return data as Report[];
    },
  });
  const resolve = useAdminRpc<{ p_id: string }>('admin_resolve_report');

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Data reports</h1>
      {!isPending && reports.length === 0 && <p className="text-muted">No open reports.</p>}
      {reports.map((r) => (
        <article
          key={r.id}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Badge>{r.kind}</Badge>
              <h2 className="mt-1 font-semibold">{r.programs?.name ?? 'Deleted program'}</h2>
              <p className="text-xs text-muted">
                {formatDate(r.created_at.slice(0, 10))}
                {r.reporter_email && ` · ${r.reporter_email}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/admin/programs/${r.program_id}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-2"
              >
                Open editor
              </Link>
              <Button
                size="sm"
                onClick={() =>
                  void resolve
                    .mutateAsync({ p_id: r.id })
                    .then(() => toast('Marked as resolved'))
                    .catch((err) => toast(errorMessage(err)))
                }
              >
                Resolve
              </Button>
            </div>
          </div>
          {r.message && <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">“{r.message}”</p>}
          {r.programs?.official_url && (
            <a
              href={r.programs.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              Official page ↗
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
