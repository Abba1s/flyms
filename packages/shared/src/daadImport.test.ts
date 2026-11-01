import { describe, expect, it } from 'vitest';
import {
  canonicalCity,
  durationSemesters,
  findUniversity,
  inferDegree,
  inferIntake,
  subjectToField,
  teachingLanguage,
  tuition,
  universityType,
  type UniversityRef,
} from './daadImport';
import { slugify } from './submissions';

describe('subjectToField', () => {
  it('maps known DAAD subjects', () => {
    expect(subjectToField('Applied Computer Science')).toBe('computer-science');
    expect(subjectToField('International Business Administration')).toBe('business-economics');
    expect(subjectToField('Urban Planning')).toBe('architecture');
    expect(subjectToField('European Law')).toBe('law');
  });
  it('falls back to keywords, then gives up', () => {
    expect(subjectToField('Quantum Engineering')).toBe('engineering');
    expect(subjectToField(null, 'Machine Learning and Data Analytics')).toBe('computer-science');
    expect(subjectToField('Xyz', 'Abc')).toBeNull();
  });
});

describe('inferDegree', () => {
  it('reads the degree from the course name only', () => {
    expect(inferDegree('M.Sc. Data Science')).toBe('MSc');
    expect(inferDegree('Master of Arts in History')).toBe('MA');
    expect(inferDegree('Global MBA')).toBe('MBA');
    expect(inferDegree('LL.M. European Law')).toBe('LLM');
    expect(inferDegree('Data Science')).toBe('Other');
    expect(inferDegree('Management')).toBe('Other');
  });
});

describe('inferIntake', () => {
  it('uses the only intake a programme has', () => {
    expect(inferIntake('2027-01-15', 'Winter semester')).toEqual({
      season: 'winter',
      academicYear: '2027/28',
    });
    expect(inferIntake('2026-11-15', 'Winter semester')).toEqual({
      season: 'winter',
      academicYear: '2027/28',
    });
    expect(inferIntake('2027-07-15', 'Winter semester')).toEqual({
      season: 'winter',
      academicYear: '2027/28',
    });
    expect(inferIntake('2027-01-15', 'Summer semester')).toEqual({
      season: 'summer',
      academicYear: '2027',
    });
  });
  it('guesses from the deadline month when both intakes exist', () => {
    expect(inferIntake('2027-01-15', 'Winter semester, Summer semester')).toEqual({
      season: 'summer',
      academicYear: '2027',
    });
    expect(inferIntake('2026-11-30', 'Winter semester, Summer semester')).toEqual({
      season: 'summer',
      academicYear: '2027',
    });
    expect(inferIntake('2027-05-31', 'Winter semester, Summer semester')).toEqual({
      season: 'winter',
      academicYear: '2027/28',
    });
  });
});

describe('small mappers', () => {
  it('maps languages, duration and tuition', () => {
    expect(teachingLanguage(['English'])).toBe('english');
    expect(teachingLanguage(['German', 'English'])).toBe('english_german');
    expect(teachingLanguage(['French'])).toBeNull();
    expect(durationSemesters('4 semesters')).toBe(4);
    expect(durationSemesters('18 months')).toBeNull();
    expect(tuition('No tuition fees')).toEqual({ fee: 0, note: null });
    expect(tuition('6,000')).toEqual({ fee: null, note: 'DAAD: 6,000' });
  });
  it('slugs and city names', () => {
    expect(slugify('Ludwig-Maximilians-Universität München')).toBe(
      'ludwig-maximilians-universitat-munchen',
    );
    expect(canonicalCity('Freiburg im Breisgau')).toBe('freiburg');
    expect(canonicalCity('Munich')).toBe('munchen');
    expect(canonicalCity('Bernburg / Saale')).toBe('bernburg');
    expect(canonicalCity('Halle (Saale)')).toBe('halle');
  });
  it('classifies institutions', () => {
    expect(universityType('Hochschule München University of Applied Sciences')).toBe(
      'university_applied_sciences',
    );
    expect(universityType('OTH Regensburg')).toBe('university_applied_sciences');
    expect(universityType('Hamburg University of Technology')).toBe('technical_university');
    expect(universityType('Max Planck Institute for the Science of Light')).toBe('other');
    expect(universityType('University of Freiburg')).toBe('university');
  });
});

describe('findUniversity', () => {
  const u = (
    id: string,
    name: string,
    city: string,
    daad_name: string | null = null,
  ): UniversityRef => ({
    id,
    name,
    short_name: null,
    city,
    daad_name,
  });
  const unis = [
    u('tub', 'TU Berlin', 'Berlin'),
    u('tum', 'Technical University of Munich', 'Munich'),
    u('marburg', 'Philipps University Marburg', 'Marburg'),
    u('bremen', 'University of Bremen', 'Bremen'),
    u('hamburg', 'TU Hamburg', 'Hamburg'),
  ];

  it('matches the same institution under different names or campuses', () => {
    expect(findUniversity('Technische Universität Berlin', 'Berlin', unis)?.id).toBe('tub');
    expect(findUniversity('Technical University of Munich', 'Freising', unis)?.id).toBe('tum');
    expect(findUniversity('Marburg University', 'Marburg', unis)?.id).toBe('marburg');
    expect(findUniversity('Hamburg University of Technology', 'Hamburg', unis)?.id).toBe('hamburg');
  });

  it('keeps different institutions in the same city apart', () => {
    expect(findUniversity('Freie Universität Berlin', 'Berlin', unis)).toBeNull();
    expect(findUniversity('HTW Berlin University of Applied Sciences', 'Berlin', unis)).toBeNull();
    expect(findUniversity('University of Hamburg', 'Hamburg', unis)).toBeNull();
    expect(
      findUniversity('Max Planck Institute for Marine Microbiology', 'Bremen', unis),
    ).toBeNull();
    expect(findUniversity('Bremen University of Applied Sciences', 'Bremen', unis)).toBeNull();
  });

  it('prefers a remembered DAAD name', () => {
    expect(
      findUniversity('LMU', 'München', [...unis, u('lmu', 'LMU Munich', 'Munich', 'LMU')])?.id,
    ).toBe('lmu');
  });
});
