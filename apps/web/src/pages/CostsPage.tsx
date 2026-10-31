import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input, Select } from '@/components/ui/Input';
import { COST_DEFAULTS, estimateCost } from '@/features/costs/estimate';
import { usePrograms } from '@/features/programs/api';
import { useLocalStore } from '@/stores/local';

const euro = (n: number) => `€${Math.round(n).toLocaleString('en-GB')}`;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 py-1.5 ${strong ? 'border-t border-border pt-3 text-base font-bold' : 'text-sm'}`}
    >
      <dt className={strong ? '' : 'text-muted'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function CostsPage() {
  const [params] = useSearchParams();
  const { programs } = usePrograms();
  const saved = useLocalStore((s) => s.saved);
  const [programId, setProgramId] = useState(params.get('program') ?? '');
  const [v, setV] = useState({
    semesters: String(COST_DEFAULTS.semesters),
    tuition: '0',
    contribution: String(COST_DEFAULTS.semesterContribution),
    living: '850',
    insurance: String(COST_DEFAULTS.insuranceMonthly),
    oneTime: String(COST_DEFAULTS.visaFee + 75 + 600),
  });

  const program = programs.find((p) => p.id === programId);
  // Fill tuition from the chosen program.
  useEffect(() => {
    if (program) setV((x) => ({ ...x, tuition: String(program.tuition_fee_eur ?? 0) }));
  }, [program]);

  const options = useMemo(() => {
    const savedIds = new Set(saved.map((s) => s.id));
    return [...programs].sort(
      (a, b) =>
        Number(savedIds.has(b.id)) - Number(savedIds.has(a.id)) || a.name.localeCompare(b.name),
    );
  }, [programs, saved]);

  const e = estimateCost({
    semesters: Number(v.semesters),
    tuitionPerSemester: Number(v.tuition),
    contributionPerSemester: Number(v.contribution),
    livingMonthly: Number(v.living),
    insuranceMonthly: Number(v.insurance),
    oneTime: Number(v.oneTime),
  });

  const field = (key: keyof typeof v, label: string, hint?: string) => (
    <Input
      label={label}
      type="number"
      min={0}
      inputMode="decimal"
      value={v[key]}
      hint={hint}
      onChange={(ev) => setV((x) => ({ ...x, [key]: ev.target.value }))}
    />
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Cost estimator</h1>
        <p className="mt-1 max-w-2xl text-muted">
          A rough budget for your whole master’s. Every number is editable — replace the defaults
          with figures from your program page and the city you’ll live in.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <Select
            label="Program (optional)"
            value={programId}
            onChange={(ev) => setProgramId(ev.target.value)}
          >
            <option value="">— Enter numbers yourself —</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.university_name}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('semesters', 'Semesters', 'Most master’s programs: 3–4')}
            {field(
              'tuition',
              'Tuition per semester (€)',
              program
                ? 'From the program data — check the official page'
                : '0 at most public universities',
            )}
            {field(
              'contribution',
              'Semester contribution (€)',
              'Usually €150–€400; often includes a transport ticket',
            )}
            {field(
              'living',
              'Living costs per month (€)',
              'Rent, food, transport, phone. Big cities cost more.',
            )}
            {field(
              'insurance',
              'Health insurance per month (€)',
              `Public student insurance ≈ €${COST_DEFAULTS.insuranceMonthly} (2025)`,
            )}
            {field(
              'oneTime',
              'One-time costs (€)',
              `Visa €${COST_DEFAULTS.visaFee}, application fees, travel, deposit`,
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border border-border bg-surface p-5" aria-live="polite">
            <h2 className="mb-2 font-semibold">Estimate · {e.months} months</h2>
            <dl>
              <Row label="Tuition" value={euro(e.tuitionTotal)} />
              <Row label="Semester contributions" value={euro(e.contributionTotal)} />
              <Row label="Living costs" value={euro(e.livingTotal)} />
              <Row label="Health insurance" value={euro(e.insuranceTotal)} />
              <Row label="One-time costs" value={euro(e.oneTime)} />
              <Row label="Total" value={euro(e.total)} strong />
              <Row label="Per semester (excl. one-time)" value={euro(e.perSemester)} />
            </dl>
          </section>
          <section className="rounded-lg border border-border bg-surface p-5 text-sm">
            <h2 className="mb-1 font-semibold">Blocked account</h2>
            <p className="text-muted">
              Most student visas need proof of about{' '}
              <strong className="text-text">{euro(e.blockedAccount)}</strong> for the first year (
              {euro(COST_DEFAULTS.blockedAccountMonthly)}/month, the{' '}
              {COST_DEFAULTS.blockedAccountYear} amount). It is paid out to you monthly.
            </p>
            {e.monthlyGap > 0 && (
              <p className="mt-2">
                Your monthly costs are {euro(e.monthlyGap)} above the monthly payout — plan for
                savings or a part-time job.
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              The required amount changes; check the German Federal Foreign Office or your embassy
              for the current figure.
            </p>
          </section>
          <Link to="/faq" className="text-sm font-semibold text-primary hover:underline">
            What are semester contributions and blocked accounts?
          </Link>
        </aside>
      </div>
    </div>
  );
}
