/**
 * SOP writer: field templates (questions + letter structure) and the request schema.
 * Shared by the wizard and the `sop-generate` / `sop-rewrite` Edge Functions
 * (copied by scripts/sync_function_shared.py).
 */
import { z } from 'zod';

export const sopTemplateIds = [
  'engineering_science',
  'computer_science',
  'business',
  'arts_design',
  'law',
  'social_humanities',
  'medicine_health',
  'education',
] as const;
export type SopTemplateId = (typeof sopTemplateIds)[number];

export const sopSectionIds = [
  'hook',
  'academic',
  'experience',
  'why_specialization',
  'why_program',
  'why_germany',
  'goals',
  'closing',
] as const;
export type SopSectionId = (typeof sopSectionIds)[number];

export interface SopQuestion {
  id: string;
  label: string;
  help: string;
  example: string;
  required: boolean;
  multiline: boolean;
}

export interface SopTemplate {
  id: SopTemplateId;
  /** Title of the "experience" section, which differs most between fields. */
  experienceTitle: string;
  /** What admissions readers in this field look for — guidance for the writer. */
  emphasis: string;
  questions: SopQuestion[];
}

const q = (
  id: string,
  label: string,
  help: string,
  example: string,
  required = true,
  multiline = true,
): SopQuestion => ({ id, label, help, example, required, multiline });

const COMMON_START: SopQuestion[] = [
  q(
    'degree',
    'Your bachelor’s degree and university',
    'Name, university, country, and graduation year (or expected).',
    'B.Sc. Electrical Engineering, BUET, Bangladesh, 2024',
    true,
    false,
  ),
  q(
    'grades',
    'Your grades',
    'CGPA with its scale, plus class rank or distinctions if you have them.',
    '3.62 / 4.00, top 10% of the department',
    true,
    false,
  ),
];

const COMMON_END: SopQuestion[] = [
  q(
    'why_specialization',
    'Why this specialization?',
    'What made you interested — a course, project, job, or problem you saw. Be specific.',
    'A power-electronics lab in my 3rd year showed me how much energy is lost in converters…',
  ),
  q(
    'why_program',
    'Why this program? (optional)',
    'Modules, labs, professors or features of this program that match your goals. Leave empty for a general letter.',
    'The Smart Grids module and the lab’s work on battery storage',
    false,
  ),
  q(
    'why_germany',
    'Why Germany?',
    'Concrete reasons: industry, research, tuition, a specific company or institute.',
    'Germany’s Energiewende and companies like Siemens Energy…',
  ),
  q(
    'short_term_goal',
    'Goal right after the master’s',
    'The role, company type or research you want next.',
    'Work as a power-systems engineer at a grid operator',
    true,
    false,
  ),
  q(
    'long_term_goal',
    'Long-term goal (5–10 years)',
    'Where you want to be and the impact you want to have.',
    'Lead renewable integration projects in South Asia',
  ),
  q(
    'challenges',
    'Anything to explain? (optional)',
    'A gap year, a low semester, a change of field — and what you did about it.',
    'A gap year in 2023 when I worked to support my family',
    false,
  ),
  q(
    'extra',
    'Anything else? (optional)',
    'Awards, publications, volunteering, languages — only if relevant.',
    'Speaks German at A2 level; volunteer coding teacher',
    false,
  ),
];

const projects = q(
  'projects',
  '1–3 projects or experiences',
  'For each: what it was, your role, tools used and the result (numbers help).',
  'Final-year project: designed a 2 kW solar inverter (MATLAB, PCB design); reached 94% efficiency',
);

export const SOP_TEMPLATES: Record<SopTemplateId, SopTemplate> = {
  engineering_science: {
    id: 'engineering_science',
    experienceTitle: 'Projects and experience',
    emphasis:
      'technical depth, methods and tools, measurable results, research or lab experience, and a clear link to the specialization',
    questions: [
      ...COMMON_START,
      q(
        'thesis',
        'Final-year project or thesis',
        'Topic, your role and what you found or built.',
        'Thesis on fatigue in welded steel joints',
      ),
      projects,
      q(
        'skills',
        'Technical skills and tools',
        'Software, lab methods, programming languages.',
        'MATLAB, SolidWorks, ANSYS, Python',
        true,
        false,
      ),
      q(
        'work',
        'Work or internship experience (optional)',
        'Company, role, duration and what you did.',
        '6-month internship at …',
        false,
      ),
      ...COMMON_END,
    ],
  },
  computer_science: {
    id: 'computer_science',
    experienceTitle: 'Projects and experience',
    emphasis:
      'concrete software or research projects, technical stack, measurable outcomes, open-source or research contributions, and fit with the specialization',
    questions: [
      ...COMMON_START,
      q(
        'thesis',
        'Final-year project or thesis',
        'Topic, your role and what you built or found.',
        'Bangla speech recognition with a fine-tuned wav2vec model',
      ),
      projects,
      q(
        'skills',
        'Technical skills',
        'Languages, frameworks, tools.',
        'Python, PyTorch, SQL, Docker',
        true,
        false,
      ),
      q(
        'work',
        'Work or internship experience (optional)',
        'Company, role, duration, what you shipped.',
        'Backend developer at …, 1.5 years',
        false,
      ),
      ...COMMON_END,
    ],
  },
  business: {
    id: 'business',
    experienceTitle: 'Professional experience',
    emphasis:
      'professional impact with numbers, leadership, teamwork, business judgment, and a credible career plan',
    questions: [
      ...COMMON_START,
      q(
        'work',
        'Work experience',
        'Employers, roles, years, and your main responsibilities.',
        'Supply-chain analyst at Unilever, 3 years',
      ),
      q(
        'impact',
        'Achievements with impact',
        'Results you drove — numbers, savings, growth.',
        'Cut stock-outs by 18% by redesigning the forecast process',
      ),
      q(
        'leadership',
        'Leadership or teamwork',
        'A time you led people or a project.',
        'Led a 6-person cross-functional team …',
      ),
      q(
        'switch',
        'Career change? (optional)',
        'If you are changing direction, explain why.',
        'Moving from engineering into management because …',
        false,
      ),
      ...COMMON_END,
    ],
  },
  arts_design: {
    id: 'arts_design',
    experienceTitle: 'Creative practice',
    emphasis:
      'artistic voice, process, key works in the portfolio, influences, and how the program will develop the practice',
    questions: [
      ...COMMON_START,
      q(
        'practice',
        'Your creative practice',
        'Media, themes and how you work.',
        'Documentary photography on urban migration',
      ),
      q(
        'portfolio',
        'Portfolio highlights',
        '2–3 works: what they are and what they show about you.',
        'A photo series “Night Shift” exhibited at …',
      ),
      q(
        'influences',
        'Influences (optional)',
        'Artists, movements or designers that shaped you.',
        'Bauhaus, Dieter Rams',
        false,
      ),
      q(
        'exhibitions',
        'Exhibitions, clients or awards (optional)',
        'Only if you have them.',
        'Group show at …, 2024',
        false,
      ),
      ...COMMON_END,
    ],
  },
  law: {
    id: 'law',
    experienceTitle: 'Legal experience',
    emphasis:
      'legal interests, analytical skill, relevant internships or moot courts, jurisdictional background, and the link to the chosen area of law',
    questions: [
      ...COMMON_START,
      q(
        'legal_interests',
        'Areas of law you are interested in',
        'And what sparked the interest.',
        'International trade law after a WTO course',
      ),
      q(
        'legal_experience',
        'Internships, clerkships or moot courts',
        'Role, what you worked on, results.',
        'Jessup Moot Court 2023, quarter-finalist',
      ),
      q(
        'jurisdiction',
        'Your legal system background',
        'Common law, civil law, Sharia, etc.',
        'Common-law background (LL.B., Pakistan)',
        true,
        false,
      ),
      q(
        'writing',
        'Research or writing (optional)',
        'Theses, papers or blog posts.',
        'Dissertation on arbitration clauses',
        false,
      ),
      ...COMMON_END,
    ],
  },
  social_humanities: {
    id: 'social_humanities',
    experienceTitle: 'Research and experience',
    emphasis:
      'research interests, methods, academic writing, fieldwork or community work, and intellectual fit with the program',
    questions: [
      ...COMMON_START,
      q(
        'research',
        'Research interests',
        'Questions you want to study and why.',
        'How climate migration changes urban labour markets',
      ),
      q(
        'thesis',
        'Thesis or major paper',
        'Topic, method and finding.',
        'Mixed-methods study of …',
      ),
      q(
        'methods',
        'Methods you know',
        'Qualitative, quantitative, archival, languages.',
        'Interviews, survey design, Stata',
        true,
        false,
      ),
      q(
        'fieldwork',
        'Fieldwork, NGO or volunteer work (optional)',
        'What you did and learned.',
        'Six months with BRAC on …',
        false,
      ),
      ...COMMON_END,
    ],
  },
  medicine_health: {
    id: 'medicine_health',
    experienceTitle: 'Clinical and research experience',
    emphasis:
      'clinical or public-health exposure, research experience, patient or population impact, and ethical awareness',
    questions: [
      ...COMMON_START,
      q(
        'clinical',
        'Clinical or public-health experience',
        'Where, your role, what you saw and did.',
        'Internship at a district hospital …',
      ),
      q(
        'research',
        'Research experience (optional)',
        'Projects, methods, publications.',
        'Co-author of a study on …',
        false,
      ),
      q(
        'health_interest',
        'The health problem you care about',
        'And why it matters to you.',
        'Maternal health in rural areas',
      ),
      ...COMMON_END,
    ],
  },
  education: {
    id: 'education',
    experienceTitle: 'Teaching experience',
    emphasis:
      'teaching experience, learners and outcomes, educational philosophy, and how the program improves practice',
    questions: [
      ...COMMON_START,
      q(
        'teaching',
        'Teaching or training experience',
        'Who you taught, what, for how long, and results.',
        'Taught English to 40 grade-8 students for 2 years',
      ),
      q(
        'pedagogy',
        'Teaching approach or interest',
        'Methods or questions about learning you care about.',
        'Project-based learning',
      ),
      q(
        'impact',
        'An example of impact (optional)',
        'A learner or class you helped improve.',
        'Pass rate rose from 60% to 85%',
        false,
      ),
      ...COMMON_END,
    ],
  },
};

export const SECTION_TITLES: Record<SopSectionId, string> = {
  hook: 'Opening',
  academic: 'Academic background',
  experience: 'Experience',
  why_specialization: 'Why this specialization',
  why_program: 'Why this program',
  why_germany: 'Why Germany',
  goals: 'Career goals',
  closing: 'Closing',
};

export function sectionTitle(template: SopTemplate, id: SopSectionId): string {
  return id === 'experience' ? template.experienceTitle : SECTION_TITLES[id];
}

export const SOP_LENGTHS = { short: 600, standard: 900, long: 1100 } as const;
export type SopLength = keyof typeof SOP_LENGTHS;

/** Hard caps that bound cost and abuse. */
export const SOP_ANSWER_MAX = 1500;
export const SOP_ANSWERS_TOTAL_MAX = 8000;

const answersSchema = z
  .record(z.string().max(60), z.string().trim().max(SOP_ANSWER_MAX))
  .refine((a) => Object.keys(a).length <= 30, 'Too many answers')
  .refine(
    (a) => Object.values(a).reduce((n, v) => n + v.length, 0) <= SOP_ANSWERS_TOTAL_MAX,
    `Answers are too long in total (max ${SOP_ANSWERS_TOTAL_MAX} characters)`,
  );

export const sopContextSchema = z.object({
  template: z.enum(sopTemplateIds),
  fieldName: z.string().trim().max(80),
  specializationName: z.string().trim().max(120),
  programId: z.string().uuid().nullable(),
  answers: answersSchema,
});
export type SopContext = z.infer<typeof sopContextSchema>;

export const sopGenerateSchema = sopContextSchema.extend({
  length: z.enum(['short', 'standard', 'long']),
});
export type SopGenerateRequest = z.infer<typeof sopGenerateSchema>;

export const sopRewriteInstructions = ['regenerate', 'specific', 'shorter', 'formal'] as const;
export type SopRewriteInstruction = (typeof sopRewriteInstructions)[number];

export const sopRewriteSchema = sopContextSchema.extend({
  sectionId: z.enum(sopSectionIds),
  sectionText: z.string().max(4000),
  instruction: z.enum(sopRewriteInstructions),
});
export type SopRewriteRequest = z.infer<typeof sopRewriteSchema>;

/** Missing required answers for a template (by question id). */
export function missingRequired(template: SopTemplate, answers: Record<string, string>): string[] {
  return template.questions
    .filter((qq) => qq.required && !(answers[qq.id] ?? '').trim())
    .map((qq) => qq.id);
}

/** Server-sent event payloads streamed by sop-generate / sop-rewrite. */
export type SopStreamEvent =
  | { type: 'section'; id: SopSectionId; title: string }
  | { type: 'delta'; id: SopSectionId; text: string }
  | { type: 'restart' }
  | { type: 'done' }
  | { type: 'error'; message: string; status?: number };
