import { getIntakeStatus, type IntakeDates } from '@flyms/shared';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/lib/theme';

const TODAY = '2026-11-01';
const statusSamples: Array<[string, IntakeDates]> = [
  ['Closing soon', { start: '2026-10-01', end: '2026-11-07' }],
  ['Open now', { start: '2026-10-01', end: '2027-01-15' }],
  ['Opening soon', { start: '2026-12-01', end: '2027-03-01' }],
  ['Closed', { start: '2026-05-01', end: '2026-07-15' }],
  ['Unknown', { start: null, end: null }],
];

const fieldSamples = [
  ['Engineering', '#2563EB'],
  ['Computer Science', '#7C3AED'],
  ['Business & Economics', '#0D9488'],
  ['Arts & Design', '#C026D3'],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export function ComponentsPage() {
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const [dialog, setDialog] = useState<'dialog' | 'sheet' | null>(null);
  const [fields, setFields] = useState<string[]>(['Engineering']);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Component sheet</h1>
          <p className="text-muted">Design tokens and base components (dev only).</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map((p) => (
            <Chip key={p} selected={preference === p} onClick={() => setPreference(p)}>
              {p[0]!.toUpperCase() + p.slice(1)}
            </Chip>
          ))}
        </div>
      </header>

      <Section title="Admission status">
        {statusSamples.map(([name, dates]) => (
          <StatusBadge key={name} status={getIntakeStatus(dates, TODAY)} />
        ))}
      </Section>

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
      </Section>

      <Section title="Field chips">
        {fieldSamples.map(([name, color]) => (
          <Chip
            key={name}
            dotColor={color}
            selected={fields.includes(name)}
            onClick={() =>
              setFields((f) => (f.includes(name) ? f.filter((x) => x !== name) : [...f, name]))
            }
          >
            {name}
          </Chip>
        ))}
      </Section>

      <Section title="Badges">
        <Badge>MSc</Badge>
        <Badge>English-taught</Badge>
        <Badge>Winter 2027/28</Badge>
        <Badge>IELTS 6.5</Badge>
      </Section>

      <Section title="Program card">
        <Card accentColor="#7C3AED" className="w-full max-w-md">
          <div className="flex flex-col gap-2">
            <StatusBadge
              status={getIntakeStatus(statusSamples[0]![1], TODAY)}
              size="sm"
              className="self-start"
            />
            <h3 className="line-clamp-2 text-lg font-semibold">M.Sc. Computer Science</h3>
            <p className="text-sm text-muted">TU Berlin · Berlin</p>
            <div className="flex flex-wrap gap-2">
              <Badge>MSc</Badge>
              <Badge>English</Badge>
              <Badge>Winter</Badge>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Form fields">
        <div className="grid w-full max-w-md gap-4">
          <Input
            label="Program name"
            placeholder="e.g. M.Sc. Data Science"
            hint="As written on the official page."
          />
          <Input
            label="Email"
            type="email"
            error="Enter a valid email address."
            defaultValue="me@"
          />
          <Select label="Intake" defaultValue="winter">
            <option value="winter">Winter</option>
            <option value="summer">Summer</option>
          </Select>
        </div>
      </Section>

      <Section title="Overlays">
        <Button variant="secondary" onClick={() => setDialog('dialog')}>
          Open dialog
        </Button>
        <Button variant="secondary" onClick={() => setDialog('sheet')}>
          Open bottom sheet
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast('Saved to My List', { label: 'Undo', onClick: () => undefined })}
        >
          Show toast
        </Button>
      </Section>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        variant={dialog ?? 'dialog'}
        title="Report wrong info"
        description="Tell us what is out of date. An admin will check it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => setDialog(null)}>Send report</Button>
          </>
        }
      >
        <Input label="What is wrong?" placeholder="The deadline is now 31 January" />
      </Dialog>
    </main>
  );
}
