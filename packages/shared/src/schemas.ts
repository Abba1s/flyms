import { z } from 'zod';
import { applicationPortals, degreeTypes, intakeSeasons, teachingLanguages } from './enums.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export * from './enums.ts';

export const intakeSchema = z.object({
  season: z.enum(intakeSeasons),
  year: z.string(),
  start: isoDate.nullable(),
  end: isoDate.nullable(),
});
export type Intake = z.infer<typeof intakeSchema>;

/** Row shape of the `v_public_programs` view (compact list payload). */
export const publicProgramSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  degree_type: z.enum(degreeTypes),
  teaching_language: z.enum(teachingLanguages),
  tuition_fee_eur: z.number().nullable(),
  application_fee_eur: z.number().nullable(),
  ielts_min: z.number().nullable(),
  moi_accepted: z.boolean().nullable(),
  german_level: z.string().nullable(),
  vpd_required: z.boolean().nullable(),
  nc_restricted: z.boolean().nullable(),
  gre_gmat: z.string().nullable(),
  portfolio_required: z.boolean(),
  application_portal: z.enum(applicationPortals).nullable(),
  official_url: z.string(),
  application_url: z.string().nullable(),
  last_verified_at: isoDate.nullable(),
  field_slug: z.string(),
  university_id: z.string().uuid(),
  university_slug: z.string(),
  university_name: z.string(),
  city: z.string(),
  german_state: z.string(),
  lat: z.number(),
  lng: z.number(),
  qs_ranking: z.string().nullable(),
  qs_ranking_sort: z.number().nullable(),
  specialization_slugs: z.array(z.string()),
  intakes: z.array(intakeSchema),
});
export type PublicProgram = z.infer<typeof publicProgramSchema>;

export const fieldSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  sop_template: z.string(),
  sort_order: z.number(),
});
export type Field = z.infer<typeof fieldSchema>;

export const specializationSchema = z.object({
  id: z.string().uuid(),
  field_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  sort_order: z.number(),
});
export type Specialization = z.infer<typeof specializationSchema>;
