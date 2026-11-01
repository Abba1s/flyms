import type { Intake } from '@flyms/shared';

export const LANGUAGE_LABEL: Record<string, string> = {
  english: 'English',
  german: 'German',
  english_german: 'English & German',
};

export const PORTAL_LABEL: Record<string, string> = {
  uni_assist: 'uni-assist',
  direct: 'University portal',
  hochschulstart: 'Hochschulstart',
  other: 'Other portal',
};

export const DEGREE_OPTIONS = [
  'MSc',
  'MA',
  'MEng',
  'MBA',
  'LLM',
  'MEd',
  'MFA',
  'MPH',
  'MRes',
  'Other',
];

/** 'Other' means the source didn't say which master's degree (e.g. DAAD imports). */
export function degreeLabel(degree: string): string {
  return degree === 'Other' ? "Master's" : degree;
}

export function intakeLabel(i: Pick<Intake, 'season' | 'year'>): string {
  return `${i.season === 'winter' ? 'Winter' : 'Summer'} ${i.year}`;
}

/** "Yes" / "No" / "Not stated" for nullable flags. */
export function yesNo(value: boolean | null): string {
  if (value === null) return 'Not stated';
  return value ? 'Yes' : 'No';
}

/** Days since a date, or null. Used for "last verified" staleness. */
export const STALE_AFTER_DAYS = 180;
