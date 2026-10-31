import type { ProgramWithStatus } from '@/features/programs/api';
import { LANGUAGE_LABEL, PORTAL_LABEL, intakeLabel, yesNo } from '@/features/programs/labels';
import { STATUS_LABEL } from '@/lib/format';

const COLUMNS = [
  'Program',
  'University',
  'City',
  'Status',
  'Intake',
  'Application opens',
  'Deadline',
  'Teaching language',
  'Degree',
  'IELTS',
  'MOI accepted',
  'VPD required',
  'NC',
  'Tuition (EUR / semester)',
  'Application fee (EUR)',
  'Apply via',
  'Application link',
  'Saved on',
] as const;

export function exportRows(
  programs: ProgramWithStatus[],
  savedAt: Map<string, string>,
): (string | number)[][] {
  return programs.map((p) => {
    const intake = p.intakes[p.status.intakeIndex] ?? p.intakes[0];
    return [
      p.name,
      p.university_name,
      p.city,
      STATUS_LABEL[p.status.status],
      intake ? intakeLabel(intake) : '',
      intake?.start ?? '',
      intake?.end ?? '',
      LANGUAGE_LABEL[p.teaching_language] ?? p.teaching_language,
      p.degree_type,
      p.ielts_min ?? '',
      yesNo(p.moi_accepted),
      yesNo(p.vpd_required),
      yesNo(p.nc_restricted),
      p.tuition_fee_eur ?? '',
      p.application_fee_eur ?? '',
      (p.application_portal && PORTAL_LABEL[p.application_portal]) ?? '',
      `${window.location.origin}/programs/${p.slug}`,
      savedAt.get(p.id)?.slice(0, 10) ?? '',
    ];
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadCsv(rows: (string | number)[][]) {
  const Papa = (await import('papaparse')).default;
  const csv = Papa.unparse({ fields: [...COLUMNS], data: rows });
  // BOM so Excel opens UTF-8 (umlauts) correctly.
  download(
    new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }),
    `flyms-my-list-${stamp()}.csv`,
  );
}

export async function downloadXlsx(rows: (string | number)[][]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('My List', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow([...COLUMNS]).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => {
    col.width = i < 2 ? 40 : i === 16 ? 50 : 18;
  });
  const buffer = await wb.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `flyms-my-list-${stamp()}.xlsx`,
  );
}

export function downloadJson(data: unknown, filename: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
