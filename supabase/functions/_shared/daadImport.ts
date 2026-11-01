// Generated from packages/shared/src by scripts/sync_function_shared.py — do not edit.
/**
 * Turn DAAD course records into program and university rows. Pure functions, shared by the
 * `deadline-sync` Edge Function and tests.
 */
import { normalizeName } from './deadlines.ts';
export { programSlug, slugify } from './submissions.ts';

export type FieldSlug =
  | 'computer-science'
  | 'engineering'
  | 'business-economics'
  | 'natural-sciences'
  | 'medicine-health'
  | 'social-sciences'
  | 'law'
  | 'arts-design'
  | 'humanities'
  | 'education'
  | 'agriculture-environment'
  | 'architecture';

const SUBJECT_FIELDS: Record<FieldSlug, string[]> = {
  'computer-science': [
    'Applied Computer Science', 'Artificial Intelligence', 'Bioinformatics', 'Computer Engineering',
    'Computer Science', 'Data Science', 'Geoinformatics', 'Information Systems and Management',
    'Information Technology', 'Media Informatics', 'Medical Informatics', 'Practical Computer Science',
    'Software Engineering', 'Computational Linguistics',
  ],
  engineering: [
    'Aeronautical Engineering', 'Automation Technology', 'Automotive Engineering', 'Bioengineering',
    'Biomedical Engineering', 'Building Services', 'Ceramics (Materials Engineering)',
    'Chemical Engineering', 'Civil Engineering', 'Clothing Engineering', 'Design Engineering',
    'Electrical Engineering', 'Electrical Power Engineering', 'Electronics', 'Engineering Physics',
    'Engineering and Management', 'Environmental Engineering', 'Geodesy', 'Hydraulic Engineering',
    'Laser Technology', 'Manufacturing Engineering', 'Marine Engineering', 'Materials Science',
    'Materials Sciences', 'Mechanical Engineering', 'Mechatronics', 'Media Technology',
    'Microelectronics', 'Microsystems Technology', 'Mine Surveying', 'Mining', 'Paper Engineering',
    'Photonics', 'Plant Engineering', 'Plastics Engineering', 'Process Technology',
    'Renewable Energies', 'Space Engineering', 'Systems Engineering', 'Traffic Engineering',
    'Biotechnology', 'Food Technology', 'Health Technology', 'Nanosciences', 'Technology Management',
  ],
  'business-economics': [
    'Accounting, Taxation, Controlling', 'Business Administration',
    'Business Management, Organization Management', 'Business Mathematics', 'Economic Sciences, Economics',
    'Economics', 'Financial Management, Insurance', 'Health Economics', 'Hotel, Catering, Tourism',
    'Human Resource Management', 'International Business Administration',
    'Logistics, Transport, Transport Management', 'Marketing, Distribution', 'Trade and Industry',
    'Agricultural Economics', 'Environmental Management, Energy Management', 'Health Management',
    'Public Management, Social Management',
  ],
  'natural-sciences': [
    'Applied Mathematics', 'Astronomy', 'Astrophysics', 'Biochemistry', 'Biology', 'Biophysics',
    'Botany', 'Chemistry', 'Experimental Physics', 'Food Chemistry', 'Geology', 'Geophysics',
    'Geosciences', 'Hydrology', 'Inorganic Chemistry', 'Marine Biology', 'Mathematics', 'Meteorology',
    'Microbiology', 'Molecular Biology', 'Physics', 'Statistics', 'Technomathematics',
    'Theoretical Chemistry', 'Physical Geography', 'Logics', 'Neuroscience',
  ],
  'medicine-health': [
    'Dental Medicine', 'Health Science', 'Human Biology, Biomedicine', 'Human Medicine',
    'Medical Physics', 'Pharmacy, Pharmacology', 'Sport', 'Sports Science',
  ],
  'social-sciences': [
    'African Studies', 'American Studies', 'Anthropogeography', 'Business, Occupational, and Organisational Psychology',
    'Communication Studies', 'Cultural Anthropology', 'Developmental Psychology', 'European Studies',
    'Gender Studies', 'Geography', 'International Relations', 'Journalism', 'Political Science',
    'Psychology', 'Social Psychology', 'Social Work', 'Sociology, Social Science', 'Intercultural Studies',
    'Chinese Studies', 'Iranian Studies, Persian', 'Turkology, Turkish',
  ],
  law: ['European Law', 'International Law', 'Public Law'],
  'arts-design': [
    'Art Theory', 'Design', 'Graphic Design', 'Industrial Design, Product Design', 'Media Design',
    'Multimedia Design', 'Music', 'Performing Arts', 'Popular Music', 'Sculpture, Plastic Arts',
    'Stage Design, Set Design', 'Visual Arts, Fine Art', 'Media Culture',
  ],
  humanities: [
    'Ancient History', 'Archaeology', 'Catholic Theology', 'Cultural History', 'Cultural Studies',
    'Culture and Technology', 'Egyptology, Ancient', 'English Studies', 'Ethics',
    'General Linguistic Science', 'General Literary Studies', 'German Studies',
    'German as a Foreign Language', 'Greek Studies', 'History', 'History of Science', 'Jewish Studies',
    'Linguistics', 'Museum Studies', 'Philosophy', 'Pre-Columbian American Studies', 'Religious Studies',
    'Romance Studies',
  ],
  education: ['Educational Research', 'International Pedagogy'],
  'agriculture-environment': [
    'Agricultural Science', 'Agriculture', 'Agrobiology', 'Ecology', 'Environmental Science',
    'Forest Science', 'Forestry', 'Husbandry', 'Landscape Conservation',
    'Nature Conservation, Environmental Protection', 'Renewable Raw Materials', 'Viticulture',
    'Waste Management',
  ],
  architecture: [
    'Architecture', 'Environmental Design', 'Historic Preservation', 'Landscape Architecture',
    'Landscape Design', 'Spatial Planning', 'Urban Planning',
  ],
};

const SUBJECT_INDEX = new Map<string, FieldSlug>(
  (Object.entries(SUBJECT_FIELDS) as [FieldSlug, string[]][]).flatMap(([field, subjects]) =>
    subjects.map((s) => [s.toLowerCase(), field] as const),
  ),
);

/** Keyword fallback for subjects DAAD adds later. Order matters: first match wins. */
const KEYWORDS: [RegExp, FieldSlug][] = [
  [/comput|informatic|software|data|artificial intelligence|machine learning|cyber/, 'computer-science'],
  [/law\b|legal/, 'law'],
  [/architect|urban|planning/, 'architecture'],
  [/medic|health|pharma|nursing|dental|clinical/, 'medicine-health'],
  [/agri|forest|ecolog|environment|sustainab/, 'agriculture-environment'],
  [/engineer|technolog|mechatron|electr|energy|materials/, 'engineering'],
  [/business|management|econom|financ|marketing|accounting|logistic/, 'business-economics'],
  [/math|physic|chemi|biolog|geo|statistic|astro|neuro/, 'natural-sciences'],
  [/design|art\b|arts|music|media/, 'arts-design'],
  [/educat|pedagog|teach/, 'education'],
  [/politic|social|sociolog|psycholog|international relations|communication|studies/, 'social-sciences'],
  [/histor|philosoph|linguist|literat|language|theolog|religio|cultur/, 'humanities'],
];

/** Map a DAAD subject (falling back to the course name) to one of our fields, or null. */
export function subjectToField(subject: string | null, courseName = ''): FieldSlug | null {
  const exact = subject ? SUBJECT_INDEX.get(subject.trim().toLowerCase()) : undefined;
  if (exact) return exact;
  for (const text of [subject ?? '', courseName]) {
    const t = text.toLowerCase();
    if (!t) continue;
    for (const [re, field] of KEYWORDS) if (re.test(t)) return field;
  }
  return null;
}

export type DegreeType = 'MSc' | 'MA' | 'MEng' | 'MBA' | 'LLM' | 'MEd' | 'MFA' | 'MPH' | 'MRes' | 'Other';

/** Degree from the course name when it says so; otherwise 'Other' (shown as "Master's"). */
export function inferDegree(courseName: string): DegreeType {
  const n = courseName;
  if (/\bMBA\b|Master of Business Administration/i.test(n)) return 'MBA';
  if (/\bLL\.?\s?M\b|Master of Laws/i.test(n)) return 'LLM';
  if (/\bM\.?\s?Eng\b|Master of Engineering/i.test(n)) return 'MEng';
  if (/\bMPH\b|Master of Public Health/i.test(n)) return 'MPH';
  if (/\bM\.?\s?Ed\b|Master of Education/i.test(n)) return 'MEd';
  if (/\bMFA\b|Master of Fine Arts/i.test(n)) return 'MFA';
  if (/\bMRes\b|Master of Research/i.test(n)) return 'MRes';
  if (/\bM\.?\s?Sc\b|Master of Science/i.test(n)) return 'MSc';
  if (/\bM\.?\s?A\b\.?|Master of Arts/.test(n)) return 'MA';
  return 'Other';
}

export type TeachingLanguage = 'english' | 'german' | 'english_german';

export function teachingLanguage(languages: readonly string[]): TeachingLanguage | null {
  const en = languages.includes('English');
  const de = languages.includes('German');
  if (en && de) return 'english_german';
  if (en) return 'english';
  if (de) return 'german';
  return null;
}

/** "4 semesters" → 4 (only values the programs table accepts). */
export function durationSemesters(text: string | null): number | null {
  const m = /^(\d+)\s+semesters?$/i.exec(text?.trim() ?? '');
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

/** DAAD's tuition text: "No tuition fees" → 0; anything else is kept as a note. */
export function tuition(text: string | null): { fee: number | null; note: string | null } {
  const t = text?.trim() ?? '';
  if (/^no tuition fees?$/i.test(t)) return { fee: 0, note: null };
  return { fee: null, note: t ? `DAAD: ${t}` : null };
}

/** Intake a deadline belongs to. Winter starts in October, summer in April. */
export function inferIntake(
  deadline: string,
  beginning: string | null,
): { season: 'winter' | 'summer'; academicYear: string } {
  const year = Number(deadline.slice(0, 4));
  const month = Number(deadline.slice(5, 7));
  const b = beginning?.toLowerCase() ?? '';
  const winterOnly = b.includes('winter') && !b.includes('summer');
  const summerOnly = b.includes('summer') && !b.includes('winter');
  // Deadlines from October to February usually serve the next summer semester; March to
  // September the coming winter semester. A programme with only one intake overrides this.
  const season = winterOnly
    ? 'winter'
    : summerOnly
      ? 'summer'
      : month >= 3 && month <= 9
        ? 'winter'
        : 'summer';
  if (season === 'winter') {
    // A deadline from October on is an early deadline for the following October.
    const start = month >= 10 ? year + 1 : year;
    return { season, academicYear: `${start}/${String((start + 1) % 100).padStart(2, '0')}` };
  }
  // Summer starts in April: deadlines after April are for next year's summer semester.
  return { season, academicYear: String(month >= 4 ? year + 1 : year) };
}

export type UniversityType =
  | 'university'
  | 'university_applied_sciences'
  | 'technical_university'
  | 'art_music'
  | 'other';

export function universityType(name: string): UniversityType {
  const n = name.toLowerCase();
  if (/max.planck|institute for|zentrum|\bschool\b|akademie|academy|campus|university of education|p(a|ä)dagogische/.test(n)) return 'other';
  if (/applied sciences|applied arts|hochschule|fachhochschule|technical university of applied|\b(th|oth|htw|hs|fh)\b/.test(n))
    return 'university_applied_sciences';
  if (/\bart\b|arts\b|music|kunst|musik|design/.test(n)) return 'art_music';
  if (/technical university|technische universität|university of technology|\btu\b|institute of technology/.test(n))
    return 'technical_university';
  return 'university';
}


const CITY_ALIASES: Record<string, string> = {
  munich: 'munchen',
  cologne: 'koln',
  nuremberg: 'nurnberg',
  hanover: 'hannover',
  brunswick: 'braunschweig',
};

/** "Freiburg im Breisgau" → "freiburg", "München" → "munchen", "Bernburg / Saale" → "bernburg". */
export function canonicalCity(city: string): string {
  const base = normalizeName(
    city.split(/\s+\/\s+|\s+(?:im|am|an der|ob der|b\.|bei|in)\s+|\s*\(/)[0] ?? city,
  );
  return CITY_ALIASES[base] ?? base;
}

export interface UniversityRef {
  id: string;
  name: string;
  short_name: string | null;
  city: string;
  daad_name: string | null;
}

const GENERIC = new Set([
  'university', 'universitat', 'universitaet', 'universitatsmedizin', 'hochschule', 'of', 'the', 'and',
  'fur', 'for', 'zu', 'in', 'am', 'an', 'der', 'applied', 'sciences', 'science', 'technical',
  'technology', 'technische', 'institute', 'tu',
]);

/**
 * Our university for a DAAD institution, or null (→ create a new one).
 * Same city and same type are required (a city often has a university, a technical university
 * and a university of applied sciences). Then: identical name, the same distinctive words
 * (city names don't count), or — when one name has no distinctive words — the only university
 * of that type in the city.
 */
export function findUniversity<T extends UniversityRef>(
  academy: string,
  city: string,
  universities: readonly T[],
): T | null {
  const byDaad = universities.find((u) => u.daad_name === academy);
  if (byDaad) return byDaad;
  // The same name is the same institution, whichever campus city DAAD lists.
  const target = normalizeName(academy);
  const exact = universities.filter(
    (u) => normalizeName(u.name) === target || (u.short_name !== null && normalizeName(u.short_name) === target),
  );
  if (exact.length === 1) return exact[0]!;
  const cityKey = canonicalCity(city);
  const sameCity = universities.filter((u) => canonicalCity(u.city) === cityKey);

  const type = universityType(academy);
  const sameType = sameCity.filter((u) => universityType(u.name) === type);
  const distinctive = (name: string, ownCity: string) => {
    const cityWords = new Set([
      ...normalizeName(city).split(' '),
      ...normalizeName(ownCity).split(' '),
      ...cityKey.split(' '),
    ]);
    return new Set(
      normalizeName(name)
        .split(' ')
        .filter((w) => w.length > 2 && !GENERIC.has(w) && !cityWords.has(w)),
    );
  };
  const a = distinctive(academy, city);
  const matches = sameType.filter((u) => {
    const b = distinctive(u.name, u.city);
    if (a.size > 0 && b.size > 0) {
      const shared = [...a].filter((w) => b.has(w)).length;
      return shared > 0 && shared === Math.min(a.size, b.size);
    }
    return sameType.length === 1;
  });
  return matches.length === 1 ? matches[0]! : null;
}
