import {
  fieldSchema,
  getProgramStatus,
  publicProgramSchema,
  specializationSchema,
  type Field,
  type ProgramStatus,
  type PublicProgram,
  type Specialization,
} from '@flyms/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToday } from '@/lib/useToday';

export type ProgramWithStatus = PublicProgram & {
  status: ProgramStatus;
  /** Whether the intake that sets the headline status has a confirmed deadline. */
  deadlineVerified: boolean;
};

export const queryKeys = {
  programs: ['programs'] as const,
  fields: ['fields'] as const,
  specializations: ['specializations'] as const,
  program: (slug: string) => ['program', slug] as const,
};

/** PostgREST returns at most 1,000 rows per request, so read the list in pages. */
async function fetchPrograms(): Promise<PublicProgram[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('v_public_programs')
      .select('*')
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return z.array(publicProgramSchema).parse(rows);
}

async function fetchFields(): Promise<Field[]> {
  const { data, error } = await supabase.from('fields').select('*').order('sort_order');
  if (error) throw error;
  return z.array(fieldSchema).parse(data);
}

async function fetchSpecializations(): Promise<Specialization[]> {
  const { data, error } = await supabase.from('specializations').select('*').order('sort_order');
  if (error) throw error;
  return z.array(specializationSchema).parse(data);
}

/** All published programs with today's admission status attached. */
/** All programs, with admission status for today (or for `asOf`, an ISO date). */
export function usePrograms(asOf?: string) {
  // The list changes with every sync (twice a day, or when an admin presses Sync now), so
  // a saved copy is shown instantly but refreshed after a few minutes.
  const query = useQuery({
    queryKey: queryKeys.programs,
    queryFn: fetchPrograms,
    staleTime: 5 * 60 * 1000,
  });
  const realToday = useToday();
  const today = asOf || realToday;
  const programs = useMemo<ProgramWithStatus[]>(
    () =>
      (query.data ?? []).map((p) => {
        const status = getProgramStatus(p.intakes, today);
        const intake = p.intakes[status.intakeIndex];
        return { ...p, status, deadlineVerified: intake?.verified !== false };
      }),
    [query.data, today],
  );
  return { ...query, programs, today };
}

export function useFields() {
  return useQuery({ queryKey: queryKeys.fields, queryFn: fetchFields, staleTime: Infinity });
}

export function useSpecializations() {
  return useQuery({
    queryKey: queryKeys.specializations,
    queryFn: fetchSpecializations,
    staleTime: Infinity,
  });
}

/** Lookup maps for fields by slug. */
export function useFieldMap() {
  const { data } = useFields();
  return useMemo(() => new Map((data ?? []).map((f) => [f.slug, f])), [data]);
}

const detailSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  degree_type: z.string(),
  teaching_language: z.string(),
  duration_semesters: z.number().nullable(),
  ects: z.number().nullable(),
  official_url: z.string(),
  application_url: z.string().nullable(),
  application_portal: z.string().nullable(),
  tuition_fee_eur: z.coerce.number().nullable(),
  tuition_note: z.string().nullable(),
  semester_contribution_eur: z.coerce.number().nullable(),
  application_fee_eur: z.coerce.number().nullable(),
  ielts_min: z.coerce.number().nullable(),
  toefl_min: z.number().nullable(),
  english_note: z.string().nullable(),
  moi_accepted: z.boolean().nullable(),
  german_level: z.string().nullable(),
  vpd_required: z.boolean().nullable(),
  aps_required: z.boolean().nullable(),
  nc_restricted: z.boolean().nullable(),
  gre_gmat: z.string().nullable(),
  entrance_exam_interview: z.string().nullable(),
  portfolio_required: z.boolean(),
  work_experience_years: z.number().nullable(),
  min_gpa_note: z.string().nullable(),
  summary: z.string().nullable(),
  letter_note: z.string().nullable(),
  last_verified_at: z.string().nullable(),
  source_url: z.string().nullable(),
  origin: z.enum(['manual', 'daad']).optional(),
  field_slug: z.string(),
  field_name: z.string(),
  university_slug: z.string(),
  university_name: z.string(),
  city: z.string(),
  german_state: z.string(),
  lat: z.number(),
  lng: z.number(),
  qs_ranking: z.string().nullable(),
  university_website: z.string().nullable(),
  highlights: z.array(z.object({ kind: z.string(), text: z.string() })),
  specializations: z.array(z.object({ slug: z.string(), name: z.string() })),
  intakes: z.array(
    z.object({
      season: z.enum(['winter', 'summer']),
      year: z.string(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      eu_end: z.string().nullable(),
      note: z.string().nullable(),
      verified: z.boolean().optional(),
      verified_at: z.string().nullable().optional(),
      verified_source: z.string().nullable().optional(),
    }),
  ),
  review_avg: z.coerce.number().nullable(),
  review_count: z.number(),
});
export type ProgramDetail = z.infer<typeof detailSchema>;

export function useProgramDetail(slug: string) {
  return useQuery({
    queryKey: queryKeys.program(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_public_program_detail')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data ? detailSchema.parse(data) : null;
    },
  });
}

/** Fire-and-forget counters; failures never affect the UI. */
export function trackProgramView(id: string) {
  const key = `flyms-viewed-${id}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Storage blocked: count anyway.
  }
  void supabase.rpc('increment_program_view', { p_id: id });
}

export function trackProgramSave(id: string, saved: boolean) {
  void supabase.rpc('increment_program_save', { p_id: id, delta: saved ? 1 : -1 });
}
