import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { adminKeys, errorMessage } from '@/features/admin/api';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const TEMPLATE_COLUMNS = [
  'slug',
  'university_slug',
  'field_slug',
  'specialization_slugs',
  'name',
  'degree_type',
  'teaching_language',
  'official_url',
  'application_url',
  'application_portal',
  'tuition_fee_eur',
  'application_fee_eur',
  'ielts_min',
  'english_note',
  'german_level',
  'moi_accepted',
  'vpd_required',
  'nc_restricted',
  'gre_gmat',
  'entrance_exam_interview',
  'portfolio_required',
  'summary',
  'source_url',
  'last_verified_at',
  'winter_year',
  'winter_start',
  'winter_end',
  'summer_year',
  'summer_start',
  'summer_end',
];

function downloadTemplate() {
  const example = [
    '',
    'tu-berlin',
    'engineering',
    'mechatronics|automotive-engineering',
    'M.Sc. Automotive Systems',
    'MSc',
    'english',
    'https://www.tu.berlin/en/',
    '',
    'direct',
    '0',
    '0',
    '6.5',
    '',
    'none',
    'yes',
    'no',
    'no',
    '',
    '',
    'no',
    '',
    'https://www.tu.berlin/en/',
    '2026-10-31',
    '2027/28',
    '2026-12-01',
    '2027-05-31',
    '',
    '',
    '',
  ];
  const csv = `${TEMPLATE_COLUMNS.join(',')}\n${example.join(',')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flyms-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportsAdminPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: batches = [] } = useQuery({
    queryKey: adminKeys.batches,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('import_batches')
        .select('id, file_path, row_count, status, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (err) throw err;
      return data;
    },
  });

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const path = `${new Date().toISOString().replace(/[:.]/g, '-')}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage
        .from('imports')
        .upload(path, file, { contentType: 'text/csv' });
      if (up.error) throw up.error;
      const { data, error: fnError } = await supabase.functions.invoke<{ batchId: string }>(
        'admin-import',
        {
          body: { filePath: path },
        },
      );
      if (fnError) {
        const ctx = (fnError as { context?: Response }).context;
        const body = ctx
          ? ((await ctx.json().catch(() => null)) as { error?: string } | null)
          : null;
        throw new Error(body?.error ?? fnError.message);
      }
      void client.invalidateQueries({ queryKey: adminKeys.batches });
      navigate(`/admin/imports/${data!.batchId}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Imports</h1>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <p className="text-sm text-muted">
          Upload a CSV of programs. Nothing changes until you review the rows and apply them. Rows
          are matched to existing programs by slug (generated from university, name and degree if
          empty).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Checking file…' : 'Upload CSV'}
          </Button>
          <Button variant="secondary" onClick={downloadTemplate}>
            Download template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 font-semibold">Recent imports</h2>
        <ul className="divide-y divide-border">
          {batches.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted">No imports yet.</li>
          )}
          {batches.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <Link to={`/admin/imports/${b.id}`} className="font-medium hover:underline">
                {b.file_path}
              </Link>
              <span className="text-muted">
                {b.row_count} rows · {b.status} · {formatDate(b.created_at.slice(0, 10))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
