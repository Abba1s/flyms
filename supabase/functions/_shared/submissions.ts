// Generated from packages/shared/src by scripts/sync_function_shared.py — do not edit.
/**
 * Public submissions and CSV import rows — validated identically in the browser and in
 * Edge Functions. scripts/sync_function_shared.py copies this file (and enums.ts) into
 * supabase/functions/_shared/, because Edge Functions can only import from that folder.
 */
import { z } from 'zod';
import {
  applicationPortals,
  degreeTypes,
  intakeSeasons,
  reportKinds,
  reviewRelations,
  teachingLanguages,
} from './enums.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const text = (max: number) => z.string().trim().max(max);
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .url('Enter a full link starting with https://')
  .refine((u) => /^https?:\/\//i.test(u), 'Enter a full link starting with https://');
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const submitterSchema = z.object({
  submitter_name: text(120).min(1, 'Enter your name'),
  submitter_email: text(254).email('Enter a valid email address'),
  submitter_phone: optional(text(40)),
});

/** What a contributor can propose about a program. All optional for updates. */
export const programProposalSchema = z.object({
  university_name: text(200).min(2, 'Enter the university'),
  university_slug: optional(text(120)),
  name: text(200).min(3, 'Enter the program name'),
  field_slug: optional(text(80)),
  degree_type: optional(z.enum(degreeTypes)),
  teaching_language: optional(z.enum(teachingLanguages)),
  official_url: httpUrl,
  application_url: optional(httpUrl),
  intake_season: optional(z.enum(intakeSeasons)),
  application_start: optional(isoDate),
  application_end: optional(isoDate),
  ielts_min: optional(z.coerce.number().min(0).max(9)),
  tuition_fee_eur: optional(z.coerce.number().min(0).max(100_000)),
  application_fee_eur: optional(z.coerce.number().min(0).max(1_000)),
  moi_accepted: optional(z.boolean()),
  vpd_required: optional(z.boolean()),
});
export type ProgramProposal = z.infer<typeof programProposalSchema>;

export const changeRequestSchema = z.discriminatedUnion('type', [
  submitterSchema.extend({
    type: z.literal('new_program'),
    proposal: programProposalSchema,
    note: optional(text(2000)),
  }),
  submitterSchema.extend({
    type: z.literal('update_program'),
    program_id: z.string().uuid(),
    proposal: programProposalSchema.partial(),
    note: text(2000).min(5, 'Tell us what changed'),
  }),
]);
export type ChangeRequestInput = z.infer<typeof changeRequestSchema>;

export const dataReportSchema = z.object({
  program_id: z.string().uuid(),
  kind: z.enum(reportKinds),
  message: optional(text(1000)),
  reporter_email: optional(text(254).email('Enter a valid email address')),
});
export type DataReportInput = z.infer<typeof dataReportSchema>;

export const questionSchema = z.object({
  name: text(120).min(1, 'Enter your name'),
  email: text(254).email('Enter a valid email address'),
  message: text(2000).min(5, 'Write your question'),
});

export const reviewSchema = z.object({
  program_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: optional(text(2000)),
  relation: z.enum(reviewRelations),
  display_name: text(80).min(1, 'Enter a display name'),
});

export const submissionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('change_request'), data: changeRequestSchema }),
  z.object({ kind: z.literal('data_report'), data: dataReportSchema }),
  z.object({ kind: z.literal('question'), data: questionSchema }),
  z.object({ kind: z.literal('review'), data: reviewSchema }),
]);
export type Submission = z.infer<typeof submissionSchema>;
export type SubmissionKind = Submission['kind'];

/** Daily per-visitor limits for each submission kind. */
export const SUBMISSION_LIMITS: Record<SubmissionKind, number> = {
  change_request: 10,
  data_report: 10,
  question: 5,
  review: 5,
};

// ─── CSV import ─────────────────────────────────────────────────────────────

const csvBool = optional(
  z.preprocess(
    (v) =>
      typeof v === 'string'
        ? ({ true: true, yes: true, false: false, no: false }[v.trim().toLowerCase()] ?? v)
        : v,
    z.boolean(),
  ),
);
const csvNumber = (min: number, max: number) => optional(z.coerce.number().min(min).max(max));

/** One CSV row of the admin program import. Column names = keys. */
export const importRowSchema = z.object({
  slug: optional(text(160)),
  university_slug: text(120).min(1, 'university_slug is required'),
  field_slug: text(80).min(1, 'field_slug is required'),
  specialization_slugs: optional(text(1000)),
  name: text(200).min(3, 'name is required'),
  degree_type: z.enum(degreeTypes),
  teaching_language: z.enum(teachingLanguages),
  official_url: httpUrl,
  application_url: optional(httpUrl),
  application_portal: optional(z.enum(applicationPortals)),
  tuition_fee_eur: csvNumber(0, 100_000),
  tuition_note: optional(text(300)),
  application_fee_eur: csvNumber(0, 1_000),
  ielts_min: csvNumber(0, 9),
  english_note: optional(text(300)),
  german_level: optional(text(60)),
  moi_accepted: csvBool,
  vpd_required: csvBool,
  nc_restricted: csvBool,
  gre_gmat: optional(text(200)),
  entrance_exam_interview: optional(text(300)),
  portfolio_required: csvBool,
  work_experience_years: optional(z.coerce.number().int().min(0).max(20)),
  summary: optional(text(1000)),
  source_url: optional(httpUrl),
  last_verified_at: optional(isoDate),
  winter_year: optional(text(9)),
  winter_start: optional(isoDate),
  winter_end: optional(isoDate),
  summer_year: optional(text(9)),
  summer_start: optional(isoDate),
  summer_end: optional(isoDate),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export function slugify(text: string): string {
  return text
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stable program slug: university + title without the degree prefix + degree. */
export function programSlug(universitySlug: string, name: string, degree: string): string {
  const title = name.replace(/^M\.?\s?(Sc|A|Eng|BA|Ed|FA|PH|Res)\.?\s*/i, '');
  return slugify(`${universitySlug} ${title} ${degree}`);
}
