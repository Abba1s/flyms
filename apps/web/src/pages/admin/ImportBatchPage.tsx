import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { adminKeys, errorMessage, useAdminRpc } from '@/features/admin/api';
import { supabase } from '@/lib/supabase';

interface ImportRowRecord {
  id: string;
  row_number: number;
  raw: Record<string, string>;
  parsed: Record<string, unknown> | null;
  action: 'new' | 'update' | 'unchanged' | 'error';
  errors: string[];
  applied_at: string | null;
}

const ACTION_TONE: Record<ImportRowRecord['action'], string> = {
  new: 'bg-st-open/12 text-st-open',
  update: 'bg-st-opening/12 text-st-opening',
  unchanged: '',
  error: 'bg-danger/10 text-danger',
};

export function ImportBatchPage() {
  const { batchId = '' } = useParams();
  const toast = useToast();
  const { data: rows = [], refetch } = useQuery({
    queryKey: adminKeys.batch(batchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_rows')
        .select('id, row_number, raw, parsed, action, errors, applied_at')
        .eq('batch_id', batchId)
        .order('row_number');
      if (error) throw error;
      return data as ImportRowRecord[];
    },
  });
  const applicable = useMemo(
    () => rows.filter((r) => (r.action === 'new' || r.action === 'update') && !r.applied_at),
    [rows],
  );
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const chosen = selected ?? new Set(applicable.map((r) => r.id));
  const apply = useAdminRpc<{ p_batch_id: string; p_row_ids: string[] }, number>(
    'apply_import_rows',
  );

  const counts = rows.reduce<Record<string, number>>(
    (c, r) => ({ ...c, [r.action]: (c[r.action] ?? 0) + 1 }),
    {},
  );

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Link to="/admin/imports" className="text-sm text-muted hover:underline">
        ← Imports
      </Link>
      <h1 className="text-2xl font-bold">Review import</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {(['new', 'update', 'unchanged', 'error'] as const).map((a) => (
          <Badge key={a} className={ACTION_TONE[a]}>
            {a}: {counts[a] ?? 0}
          </Badge>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Apply</span>
              </th>
              <th className="px-3 py-2">Line</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Program</th>
              <th className="px-3 py-2">Problems</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const canApply = applicable.some((a) => a.id === r.id);
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    {canApply && (
                      <input
                        type="checkbox"
                        checked={chosen.has(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={`Apply line ${r.row_number}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.row_number}</td>
                  <td className="px-3 py-2">
                    <Badge className={ACTION_TONE[r.action]}>
                      {r.applied_at ? 'applied' : r.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{String(r.parsed?.name ?? r.raw.name ?? '—')}</p>
                    <p className="text-xs text-muted">
                      {String(r.parsed?.slug ?? r.raw.university_slug ?? '')}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-danger">
                    {r.errors.length > 0 ? (
                      <ul className="list-disc pl-4">
                        {r.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-4 py-3 md:left-56">
        <span className="text-sm text-muted">{chosen.size} rows selected</span>
        <Button
          disabled={chosen.size === 0 || apply.isPending}
          onClick={() =>
            void apply
              .mutateAsync({ p_batch_id: batchId, p_row_ids: [...chosen] })
              .then((n) => {
                toast(`Applied ${n} rows`);
                setSelected(null);
                void refetch();
              })
              .catch((err) => toast(errorMessage(err)))
          }
        >
          {apply.isPending ? 'Applying…' : 'Apply selected'}
        </Button>
      </div>
    </div>
  );
}
