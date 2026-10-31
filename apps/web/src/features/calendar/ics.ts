import type { Intake } from '@flyms/shared';
import { intakeLabel } from '@/features/programs/labels';
import { track } from '@/lib/analytics';

export interface CalendarEvent {
  uid: string;
  date: string; // YYYY-MM-DD
  kind: 'deadline' | 'opens';
  title: string;
  programId: string;
  programSlug: string;
  university: string;
}

interface ProgramLike {
  id: string;
  slug: string;
  name: string;
  university_name: string;
  intakes: Intake[];
}

/** Deadline and opening-date events for programs, sorted by date. */
export function eventsFor(programs: ProgramLike[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const p of programs) {
    for (const i of p.intakes) {
      const key = `${p.id}-${i.season}-${i.year}`;
      if (i.end) {
        events.push({
          uid: `${key}-deadline@flyms`,
          date: i.end,
          kind: 'deadline',
          title: `Deadline: ${p.name} (${intakeLabel(i)})`,
          programId: p.id,
          programSlug: p.slug,
          university: p.university_name,
        });
      }
      if (i.start) {
        events.push({
          uid: `${key}-opens@flyms`,
          date: i.start,
          kind: 'opens',
          title: `Applications open: ${p.name} (${intakeLabel(i)})`,
          programId: p.id,
          programSlug: p.slug,
          university: p.university_name,
        });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = (iso: string) => iso.replace(/-/g, '');

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** An iCalendar file with all-day events; deadlines get a reminder 7 days before. */
export function buildIcs(events: CalendarEvent[], origin: string, now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UTEC//Application deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Master’s application deadlines',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(`${e.university}\nDetails: ${origin}/programs/${e.programSlug}\nAlways confirm dates on the official page.`)}`,
      `URL:${origin}/programs/${e.programSlug}`,
      'TRANSP:TRANSPARENT',
    );
    if (e.kind === 'deadline') {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.title)} in 7 days`,
        'TRIGGER:-P7D',
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function downloadIcs(events: CalendarEvent[], filename: string) {
  track('Calendar Export');
  const blob = new Blob([buildIcs(events, window.location.origin)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
