import { getProgramStatus, type Intake } from '@flyms/shared';
import type { ProgramWithStatus } from '@/features/programs/api';
import { groupByUniversity, groupProgramsByStatus } from './aggregate';

const TODAY = '2026-11-01';

function p(id: string, uni: string, intake: Pick<Intake, 'start' | 'end'>): ProgramWithStatus {
  const intakes: Intake[] = [{ season: 'summer', year: '2027', ...intake }];
  return {
    id,
    slug: id,
    name: `Program ${id}`,
    university_id: uni,
    university_slug: uni,
    university_name: `University ${uni}`,
    city: 'City',
    german_state: 'State',
    lat: 50,
    lng: 10,
    qs_ranking: null,
    qs_ranking_sort: null,
    intakes,
    status: getProgramStatus(intakes, TODAY),
  } as ProgramWithStatus;
}

const closing = { start: '2026-10-01', end: '2026-11-05' };
const open = { start: '2026-10-01', end: '2027-01-15' };
const opening = { start: '2026-12-01', end: '2027-02-01' };
const closed = { start: '2026-05-01', end: '2026-07-15' };

describe('groupByUniversity', () => {
  const pins = groupByUniversity([
    p('a1', 'A', open),
    p('a2', 'A', opening),
    p('b1', 'B', closing),
    p('b2', 'B', open),
    p('c1', 'C', closed),
  ]);

  it('colours each pin by its most urgent program', () => {
    expect(pins.map((x) => [x.id, x.status])).toEqual([
      ['B', 'closing_soon'],
      ['A', 'open'],
      ['C', 'closed'],
    ]);
  });

  it('counts programs that are open now (including closing soon)', () => {
    expect(pins.map((x) => x.openCount)).toEqual([2, 1, 0]);
  });

  it('orders programs inside a pin by urgency', () => {
    expect(pins[1]!.programs.map((x) => x.id)).toEqual(['a1', 'a2']);
  });
});

describe('groupProgramsByStatus', () => {
  it('groups in urgency order and drops empty groups', () => {
    const groups = groupProgramsByStatus([
      p('1', 'A', opening),
      p('2', 'A', closing),
      p('3', 'A', open),
    ]);
    expect(groups.map((g) => g.status)).toEqual(['closing_soon', 'open', 'opening_soon']);
  });
});
