import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/features/programs/api';
import { supabase } from '@/lib/supabase';

// ─── Session ────────────────────────────────────────────────────────────────

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export function useIsAdmin(session: Session | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'is-admin', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data === true;
    },
  });
}

// ─── Admin data ─────────────────────────────────────────────────────────────

/** Throw on error; cast rows to the shape we selected (Supabase infers loosely without generated types). */
const unwrap = <T>({ data, error }: { data: unknown; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

export const adminKeys = {
  all: ['admin'] as const,
  programs: ['admin', 'programs'] as const,
  program: (id: string) => ['admin', 'program', id] as const,
  universities: ['admin', 'universities'] as const,
  stats: ['admin', 'stats'] as const,
  queueCounts: ['admin', 'queue-counts'] as const,
  changes: ['admin', 'changes'] as const,
  reports: ['admin', 'reports'] as const,
  batches: ['admin', 'batches'] as const,
  batch: (id: string) => ['admin', 'batch', id] as const,
};

export interface AdminProgramRow {
  id: string;
  slug: string;
  name: string;
  state: 'draft' | 'published';
  origin: 'manual' | 'daad';
  deleted_at: string | null;
  last_verified_at: string | null;
  updated_at: string;
  field_id: string;
  university_id: string;
  universities: { name: string; slug: string } | null;
  fields: { name: string; slug: string } | null;
}

export function useAdminPrograms() {
  return useQuery({
    queryKey: adminKeys.programs,
    queryFn: async () => {
      // More than 1,000 programs once DAAD imports run; PostgREST caps each request at 1,000.
      const rows: AdminProgramRow[] = [];
      for (let from = 0; ; from += 1000) {
        const page = unwrap<AdminProgramRow[]>(
          await supabase
            .from('programs')
            .select(
              'id, slug, name, state, origin, deleted_at, last_verified_at, updated_at, field_id, university_id, universities(name, slug), fields(name, slug)',
            )
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, from + 999),
        );
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    },
  });
}

export interface AdminProgram extends Record<string, unknown> {
  id: string;
  slug: string;
  name: string;
  state: 'draft' | 'published';
  deleted_at: string | null;
  program_intakes: {
    season: 'winter' | 'summer';
    academic_year: string;
    application_start: string | null;
    application_end: string | null;
    eu_end: string | null;
    note: string | null;
  }[];
  program_specializations: { specialization_id: string }[];
  program_highlights: { kind: string; text: string; sort_order: number }[];
}

export function useAdminProgram(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.program(id ?? 'new'),
    enabled: Boolean(id),
    queryFn: async () =>
      unwrap<AdminProgram>(
        await supabase
          .from('programs')
          .select(
            '*, program_intakes(*), program_specializations(specialization_id), program_highlights(*)',
          )
          .eq('id', id!)
          .single(),
      ),
  });
}

export interface UniversityRow {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  type: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  website: string | null;
  qs_ranking: string | null;
  qs_ranking_sort: number | null;
  deleted_at: string | null;
}

export function useAdminUniversities() {
  return useQuery({
    queryKey: adminKeys.universities,
    queryFn: async () =>
      unwrap<UniversityRow[]>(await supabase.from('universities').select('*').order('name')),
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: async () => {
      // Refresh is cheap at this size; it keeps the dashboard current.
      const rows = unwrap<
        {
          field_slug: string;
          published: number;
          drafts: number;
          open_now: number;
          stale: number;
          refreshed_at: string;
        }[]
      >(await supabase.rpc('admin_stats'));
      return rows;
    },
  });
}

export function useQueueCounts() {
  return useQuery({
    queryKey: adminKeys.queueCounts,
    queryFn: async () => {
      const [changes, reports, questions, reviews, deadlines] = await Promise.all([
        supabase
          .from('change_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('data_reports')
          .select('id', { count: 'exact', head: true })
          .is('resolved_at', null),
        supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .is('deleted_at', null),
        supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('deadline_changes')
          .select('id', { count: 'exact', head: true })
          .eq('action', 'flagged')
          .is('resolved_at', null),
      ]);
      return {
        changes: changes.count ?? 0,
        reports: reports.count ?? 0,
        questions: questions.count ?? 0,
        reviews: reviews.count ?? 0,
        deadlines: deadlines.count ?? 0,
      };
    },
  });
}

/** Run an admin RPC and refresh admin + public caches afterwards. */
export function useAdminRpc<TArgs extends Record<string, unknown>, TResult = unknown>(fn: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => unwrap<TResult>(await supabase.rpc(fn, args)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.all });
      void client.invalidateQueries({ queryKey: queryKeys.programs });
    },
  });
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String(err.message);
  return 'Something went wrong';
}
