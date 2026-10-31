import { slugify, type ProgramProposal } from '@flyms/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  adminKeys,
  errorMessage,
  useAdminProgram,
  useAdminRpc,
  useAdminUniversities,
} from '@/features/admin/api';
import { buildProgramPayload } from '@/features/admin/proposal';
import { useFields } from '@/features/programs/api';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useToday } from '@/lib/useToday';

interface ChangeRequest {
  id: string;
  type: 'new_program' | 'update_program';
  program_id: string | null;
  payload: Partial<ProgramProposal>;
  note: string | null;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string | null;
  created_at: string;
  programs: { name: string; slug: string } | null;
}

const LABELS: Partial<Record<keyof ProgramProposal, string>> = {
  university_name: 'University',
  name: 'Program',
  field_slug: 'Field',
  degree_type: 'Degree',
  teaching_language: 'Language',
  official_url: 'Official page',
  application_url: 'Application link',
  intake_season: 'Intake',
  application_start: 'Opens',
  application_end: 'Deadline',
  ielts_min: 'IELTS',
  tuition_fee_eur: 'Tuition (€)',
  application_fee_eur: 'Application fee (€)',
};

export function ChangesQueuePage() {
  const { data: requests = [], isPending } = useQuery({
    queryKey: adminKeys.changes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_requests')
        .select('*, programs(name, slug)')
        .eq('status', 'pending')
        .order('created_at');
      if (error) throw error;
      return data as ChangeRequest[];
    },
  });
  const [active, setActive] = useState<ChangeRequest | null>(null);

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Change requests</h1>
      {!isPending && requests.length === 0 && <p className="text-muted">Nothing waiting. 🎉</p>}
      {requests.map((r) => (
        <article
          key={r.id}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Badge
                className={
                  r.type === 'new_program'
                    ? 'bg-st-open/12 text-st-open'
                    : 'bg-st-opening/12 text-st-opening'
                }
              >
                {r.type === 'new_program' ? 'New program' : 'Update'}
              </Badge>
              <h2 className="mt-1 font-semibold">
                {r.type === 'update_program' && r.programs ? (
                  <Link to={`/admin/programs/${r.program_id}`} className="hover:underline">
                    {r.programs.name}
                  </Link>
                ) : (
                  `${r.payload.name ?? 'Unnamed'} — ${r.payload.university_name ?? ''}`
                )}
              </h2>
              <p className="text-xs text-muted">
                {r.submitter_name} · {r.submitter_email}
                {r.submitter_phone && ` · ${r.submitter_phone}`} ·{' '}
                {formatDate(r.created_at.slice(0, 10))}
              </p>
            </div>
            <Button size="sm" onClick={() => setActive(r)}>
              Review
            </Button>
          </div>
          {r.note && <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">“{r.note}”</p>}
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {Object.entries(r.payload).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted">{LABELS[k as keyof ProgramProposal] ?? k}:</dt>
                <dd className="break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
      {active && <ReviewDialog request={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ReviewDialog({ request, onClose }: { request: ChangeRequest; onClose: () => void }) {
  const { data: universities = [] } = useAdminUniversities();
  const { data: fields = [] } = useFields();
  const { data: current } = useAdminProgram(request.program_id ?? undefined);
  const today = useToday();
  const toast = useToast();
  const p = request.payload;

  const guessUni =
    universities.find((u) => u.slug === p.university_slug) ??
    universities.find((u) => slugify(u.name) === slugify(p.university_name ?? ''));
  const [universityId, setUniversityId] = useState(guessUni?.id ?? '');
  const [fieldId, setFieldId] = useState(fields.find((f) => f.slug === p.field_slug)?.id ?? '');
  const [degree, setDegree] = useState(p.degree_type ?? 'MSc');
  const [language, setLanguage] = useState(p.teaching_language ?? 'english');
  const [publish, setPublish] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const approve = useAdminRpc<{ p_id: string; p_final_payload: Record<string, unknown> }>(
    'admin_approve_change_request',
  );
  const reject = useAdminRpc<{ p_id: string; p_reason: string }>('admin_reject_change_request');
  const isNew = request.type === 'new_program';
  const uni = universities.find((u) => u.id === (universityId || guessUni?.id));

  const onApprove = async () => {
    setError(null);
    if (isNew && (!uni || !fieldId)) return setError('Choose the university and field first.');
    if (!isNew && !current) return setError('The program is still loading.');
    const payload = buildProgramPayload(
      p,
      {
        university_id: uni?.id ?? '',
        university_slug: uni?.slug ?? '',
        field_id: fieldId,
        degree_type: degree,
        teaching_language: language,
        publish,
      },
      today,
      isNew ? undefined : { intakes: current!.program_intakes },
    );
    try {
      await approve.mutateAsync({ p_id: request.id, p_final_payload: payload });
      toast('Approved and applied');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onReject = async () => {
    try {
      await reject.mutateAsync({ p_id: request.id, p_reason: reason || 'Not accepted' });
      toast('Rejected');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Approve new program' : 'Approve update'}
      description="Check the proposal against the official page before approving."
      footer={
        <>
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          <Button variant="danger" onClick={() => void onReject()} disabled={reject.isPending}>
            Reject
          </Button>
          <Button onClick={() => void onApprove()} disabled={approve.isPending}>
            {approve.isPending ? 'Applying…' : 'Approve & apply'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {p.official_url && (
          <a
            href={p.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary underline"
          >
            Open the official page ↗
          </a>
        )}
        {isNew ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={`University (submitted: ${p.university_name ?? '—'})`}
              value={universityId || guessUni?.id || ''}
              onChange={(e) => setUniversityId(e.target.value)}
            >
              <option value="">Choose… (add it under Universities if missing)</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <Select label="Field" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              <option value="">Choose…</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Input
              label="Degree"
              value={degree}
              onChange={(e) => setDegree(e.target.value as typeof degree)}
            />
            <Select
              label="Teaching language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
            >
              <option value="english">English</option>
              <option value="german">German</option>
              <option value="english_german">English & German</option>
            </Select>
            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
              />
              Publish immediately (otherwise saved as draft)
            </label>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Only the proposed fields are changed. Intake dates are merged into the existing intakes.
            For bigger edits, open the program editor instead.
          </p>
        )}
        <Input
          label="Reason (if rejecting)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
