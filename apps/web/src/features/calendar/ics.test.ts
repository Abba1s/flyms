import { checklistFor } from '@/features/mylist/checklist';
import { buildIcs, eventsFor } from './ics';

const program = {
  id: 'p1',
  slug: 'tu-berlin-cs-msc',
  name: 'M.Sc. Computer Science, Data; Systems',
  university_name: 'TU Berlin',
  intakes: [
    { season: 'winter' as const, year: '2027/28', start: '2027-01-01', end: '2027-05-31' },
    { season: 'summer' as const, year: '2027', start: null, end: '2027-01-15' },
  ],
};

describe('eventsFor', () => {
  it('creates deadline and opening events sorted by date', () => {
    const events = eventsFor([program]);
    expect(events.map((e) => [e.date, e.kind])).toEqual([
      ['2027-01-01', 'opens'],
      ['2027-01-15', 'deadline'],
      ['2027-05-31', 'deadline'],
    ]);
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(
    eventsFor([program]),
    'https://flyms.example',
    new Date('2026-11-01T10:00:00Z'),
  );

  it('is a valid all-day calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270531\r\nDTEND;VALUE=DATE:20270601');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it('escapes commas and semicolons and adds reminders to deadlines only', () => {
    expect(ics).toContain('M.Sc. Computer Science\\, Data\\; Systems');
    expect(ics.match(/TRIGGER:-P7D/g)).toHaveLength(2);
  });

  it('folds long lines to 75 octets', () => {
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe('checklistFor', () => {
  const base = {
    teaching_language: 'english' as const,
    moi_accepted: null,
    ielts_min: 6.5,
    german_level: null,
    vpd_required: null,
    application_portal: 'direct' as const,
    portfolio_required: false,
    gre_gmat: null,
    application_fee_eur: 0,
  };

  it('suggests documents from requirements', () => {
    const ids = checklistFor(base).map((i) => i.id);
    expect(ids).toContain('english');
    expect(ids).not.toContain('vpd');
    expect(ids).not.toContain('german');
    expect(checklistFor(base).find((i) => i.id === 'english')!.label).toContain('IELTS 6.5+');
  });

  it('adds VPD, uni-assist, MOI wording, German and fee when relevant', () => {
    const items = checklistFor({
      ...base,
      moi_accepted: true,
      vpd_required: true,
      application_portal: 'uni_assist',
      teaching_language: 'english_german',
      german_level: 'B2',
      application_fee_eur: 75,
    });
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['vpd', 'uni_assist', 'german', 'fee']));
    expect(items.find((i) => i.id === 'english')!.label).toContain('MOI');
  });
});
