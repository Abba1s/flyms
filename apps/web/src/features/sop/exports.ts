import { letterText } from '@flyms/shared';
import type { SopDraft } from '@/stores/sop';

function paragraphs(draft: SopDraft): string[] {
  return letterText(draft.sections)
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function filename(draft: SopDraft, ext: string): string {
  const base = (draft.programName ?? draft.specializationName ?? 'statement-of-purpose')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `sop-${base || 'draft'}.${ext}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyLetter(draft: SopDraft): Promise<void> {
  await navigator.clipboard.writeText(letterText(draft.sections));
}

export async function downloadDocx(draft: SopDraft): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
  const body = paragraphs(draft).map(
    (p) =>
      new Paragraph({
        children: [new TextRun({ text: p, font: 'Times New Roman', size: 22 })],
        spacing: { after: 160, line: 300 },
        alignment: AlignmentType.JUSTIFIED,
      }),
  );
  const doc = new Document({
    creator: 'FlyMS',
    title: 'Statement of Purpose',
    sections: [
      {
        properties: { page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Statement of Purpose',
                bold: true,
                font: 'Times New Roman',
                size: 28,
              }),
            ],
            spacing: { after: 120 },
          }),
          ...(draft.programName
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: draft.programName,
                      font: 'Times New Roman',
                      size: 22,
                      italics: true,
                    }),
                  ],
                  spacing: { after: 280 },
                }),
              ]
            : []),
          ...body,
        ],
      },
    ],
  });
  download(await Packer.toBlob(doc), filename(draft, 'docx'));
}

export async function downloadPdf(draft: SopDraft): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 25;
  const width = 210 - margin * 2;
  const bottom = 297 - margin;
  let y = margin;

  const write = (
    text: string,
    size: number,
    style: 'normal' | 'bold' | 'italic',
    gapAfter: number,
  ) => {
    pdf.setFont('times', style);
    pdf.setFontSize(size);
    const lineHeight = size * 0.3528 * 1.45; // pt → mm, 1.45 line spacing
    for (const line of pdf.splitTextToSize(text, width) as string[]) {
      if (y + lineHeight > bottom) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
    y += gapAfter;
  };

  write('Statement of Purpose', 14, 'bold', 2);
  if (draft.programName) write(draft.programName, 11, 'italic', 4);
  for (const p of paragraphs(draft)) write(p, 11, 'normal', 3);
  pdf.save(filename(draft, 'pdf'));
}
