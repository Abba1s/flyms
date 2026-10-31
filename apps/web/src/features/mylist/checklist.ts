import type { PublicProgram } from '@flyms/shared';

export interface ChecklistItem {
  id: string;
  label: string;
  hint?: string;
}

/** Documents to prepare, suggested from the program's requirements. */
export function checklistFor(
  p: Pick<
    PublicProgram,
    | 'teaching_language'
    | 'moi_accepted'
    | 'ielts_min'
    | 'german_level'
    | 'vpd_required'
    | 'application_portal'
    | 'portfolio_required'
    | 'gre_gmat'
    | 'application_fee_eur'
  >,
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'cv', label: 'CV (Europass or academic format)' },
    { id: 'transcripts', label: 'Transcripts of records' },
    { id: 'degree', label: 'Degree certificate (or provisional certificate)' },
    { id: 'sop', label: 'Statement of Purpose / motivation letter' },
    { id: 'lor', label: 'Letters of recommendation', hint: 'Usually 2 — check the program page' },
    { id: 'passport', label: 'Passport copy' },
  ];
  if (p.teaching_language !== 'german') {
    items.push(
      p.moi_accepted
        ? {
            id: 'english',
            label: 'English proof: IELTS/TOEFL or MOI letter',
            hint: 'This program accepts a Medium of Instruction letter',
          }
        : {
            id: 'english',
            label: `English test${p.ielts_min !== null ? ` (IELTS ${p.ielts_min.toFixed(1)}+)` : ' (IELTS/TOEFL)'}`,
          },
    );
  }
  if (p.teaching_language !== 'english' || (p.german_level && p.german_level !== 'none')) {
    items.push({
      id: 'german',
      label: `German certificate${p.german_level && p.german_level !== 'none' ? ` (${p.german_level})` : ''}`,
    });
  }
  items.push({
    id: 'aps',
    label: 'APS certificate',
    hint: 'Only for applicants from countries that require it (e.g. India, China, Vietnam)',
  });
  if (p.vpd_required)
    items.push({
      id: 'vpd',
      label: 'VPD from uni-assist',
      hint: 'Takes 4–6 weeks — request early',
    });
  if (p.application_portal === 'uni_assist')
    items.push({ id: 'uni_assist', label: 'uni-assist application submitted' });
  if (p.portfolio_required) items.push({ id: 'portfolio', label: 'Portfolio' });
  if (p.gre_gmat && /required/i.test(p.gre_gmat))
    items.push({ id: 'gre_gmat', label: 'GRE / GMAT score report' });
  if (p.application_fee_eur && p.application_fee_eur > 0) {
    items.push({ id: 'fee', label: `Application fee paid (€${p.application_fee_eur})` });
  }
  return items;
}
