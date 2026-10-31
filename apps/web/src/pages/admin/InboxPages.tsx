import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { adminKeys, errorMessage, useAdminRpc } from '@/features/admin/api';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';

const when = (iso: string) => `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;

// ─── Questions ──────────────────────────────────────────────────────────────

interface Question {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function QuestionsQueuePage() {
  const toast = useToast();
  const [showRead, setShowRead] = useState(false);
  const { data: questions = [], isPending } = useQuery({
    queryKey: [...adminKeys.all, 'questions', showRead],
    queryFn: async () => {
      let q = supabase
        .from('questions')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (!showRead) q = q.eq('is_read', false);
      const { data, error } = await q;
      if (error) throw error;
      return data as Question[];
    },
  });
  const markRead = useAdminRpc<{ p_id: string; p_read: boolean }>('admin_mark_question_read');
  const remove = useAdminRpc<{ p_id: string }>('admin_delete_question');
  const fail = (err: unknown) => toast(errorMessage(err));

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Questions</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showRead}
            onChange={(e) => setShowRead(e.target.checked)}
          />
          Show read
        </label>
      </div>
      {!isPending && questions.length === 0 && <p className="text-muted">Inbox zero.</p>}
      {questions.map((q) => (
        <article
          key={q.id}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm">
              <strong>{q.name}</strong> ·{' '}
              <a href={`mailto:${q.email}`} className="text-primary hover:underline">
                {q.email}
              </a>{' '}
              <span className="text-muted">· {when(q.created_at)}</span>
              {q.is_read && <Badge className="ml-2">read</Badge>}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void markRead.mutateAsync({ p_id: q.id, p_read: !q.is_read }).catch(fail)
                }
              >
                {q.is_read ? 'Mark unread' : 'Mark read'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  void remove
                    .mutateAsync({ p_id: q.id })
                    .then(() => toast('Deleted'))
                    .catch(fail)
                }
              >
                Delete
              </Button>
            </div>
          </div>
          <p className="whitespace-pre-line rounded-md bg-surface-2 px-3 py-2 text-sm">
            {q.message}
          </p>
        </article>
      ))}
    </div>
  );
}

// ─── Reviews ────────────────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  program_id: string;
  rating: number;
  comment: string | null;
  relation: string;
  display_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  programs: { name: string; slug: string } | null;
}

export function ReviewsQueuePage() {
  const toast = useToast();
  const [status, setStatus] = useState<ReviewRow['status']>('pending');
  const { data: reviews = [], isPending } = useQuery({
    queryKey: [...adminKeys.all, 'reviews', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, programs(name, slug)')
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ReviewRow[];
    },
  });
  const setReviewStatus = useAdminRpc<{ p_id: string; p_status: ReviewRow['status'] }>(
    'admin_set_review_status',
  );
  const remove = useAdminRpc<{ p_id: string }>('admin_delete_review');
  const fail = (err: unknown) => toast(errorMessage(err));

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reviews</h1>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ReviewRow['status'])}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {!isPending && reviews.length === 0 && <p className="text-muted">No {status} reviews.</p>}
      {reviews.map((r) => (
        <article
          key={r.id}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              {r.programs && (
                <Link to={`/programs/${r.programs.slug}`} className="font-semibold hover:underline">
                  {r.programs.name}
                </Link>
              )}
              <p className="text-sm">
                <span className="text-[#E0A100]" aria-label={`${r.rating} stars`}>
                  {'★'.repeat(r.rating)}
                </span>{' '}
                {r.display_name}{' '}
                <span className="text-muted">
                  · {r.relation.replace('_', ' ')} · {when(r.created_at)}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              {r.status !== 'approved' && (
                <Button
                  size="sm"
                  onClick={() =>
                    void setReviewStatus
                      .mutateAsync({ p_id: r.id, p_status: 'approved' })
                      .then(() => toast('Approved'))
                      .catch(fail)
                  }
                >
                  Approve
                </Button>
              )}
              {r.status !== 'rejected' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void setReviewStatus
                      .mutateAsync({ p_id: r.id, p_status: 'rejected' })
                      .then(() => toast('Rejected'))
                      .catch(fail)
                  }
                >
                  Reject
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  void remove
                    .mutateAsync({ p_id: r.id })
                    .then(() => toast('Deleted'))
                    .catch(fail)
                }
              >
                Delete
              </Button>
            </div>
          </div>
          {r.comment && (
            <p className="whitespace-pre-line rounded-md bg-surface-2 px-3 py-2 text-sm">
              {r.comment}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

// ─── Audit log ──────────────────────────────────────────────────────────────

interface AuditRow {
  id: number;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

/** Fields that changed between two snapshots (ignoring bookkeeping columns). */
function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  if (!before || !after) return [];
  return Object.keys(after).filter(
    (k) =>
      !['updated_at', 'created_at'].includes(k) &&
      JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
}

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const size = 50;
  const { data: rows = [], isPending } = useQuery({
    queryKey: [...adminKeys.all, 'audit', page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * size, page * size + size - 1);
      if (error) throw error;
      return data as AuditRow[];
    },
  });
  const { data: admins = [] } = useQuery({
    queryKey: [...adminKeys.all, 'admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_users').select('user_id, display_name');
      if (error) throw error;
      return data as { user_id: string; display_name: string | null }[];
    },
  });
  const nameOf = (id: string | null) =>
    admins.find((a) => a.user_id === id)?.display_name ?? id?.slice(0, 8) ?? 'system';

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Changes</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const changed = changedFields(r.before, r.after);
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">
                    {when(r.created_at)}
                  </td>
                  <td className="px-3 py-2">{nameOf(r.actor)}</td>
                  <td className="px-3 py-2">
                    <Badge>{r.action}</Badge>
                    {r.entity === 'programs' && r.entity_id && (
                      <Link
                        to={`/admin/programs/${r.entity_id}`}
                        className="ml-2 text-xs text-primary hover:underline"
                      >
                        open
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {changed.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer">{changed.join(', ')}</summary>
                        <ul className="mt-1 space-y-0.5">
                          {changed.map((k) => (
                            <li key={k} className="break-all">
                              <strong>{k}:</strong> {JSON.stringify(r.before?.[k])} →{' '}
                              {JSON.stringify(r.after?.[k])}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : r.after ? (
                      <span className="break-all text-muted">
                        {JSON.stringify(r.after).slice(0, 160)}
                      </span>
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
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Newer
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={rows.length < size}
          onClick={() => setPage((p) => p + 1)}
        >
          Older
        </Button>
      </div>
    </div>
  );
}
