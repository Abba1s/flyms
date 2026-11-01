import type { Field, Specialization } from '@flyms/shared';
import { useMemo } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Input';
import type { ProgramWithStatus } from './api';
import type { Filters, StatusFilter, TriState } from './filters';
import { DEGREE_OPTIONS } from './labels';

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Applications open' },
  { value: 'closing3', label: 'Closing in 3 days' },
  { value: 'closing7', label: 'Closing in 7 days' },
  { value: 'closing', label: 'Closing in 15 days' },
  { value: 'opening', label: 'Upcoming intake' },
  { value: 'closed', label: 'Applications closed' },
  { value: 'all', label: 'All' },
];

export function StatusChips({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts?: Partial<Record<StatusFilter, number>>;
}) {
  return (
    <div role="radiogroup" aria-label="Admission status" className="flex gap-2 overflow-x-auto">
      {STATUS_OPTIONS.map((o) => (
        <Chip
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          aria-pressed={undefined}
          selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {counts?.[o.value] !== undefined && (
            <span className="tabular-nums">{counts[o.value]}</span>
          )}
        </Chip>
      ))}
    </div>
  );
}

export function FieldChips({
  fields,
  selected,
  onChange,
}: {
  fields: Field[];
  selected: string[];
  onChange: (slugs: string[]) => void;
}) {
  return (
    <div role="group" aria-label="Fields" className="flex gap-2 overflow-x-auto pb-1">
      {fields.map((f) => (
        <Chip
          key={f.slug}
          dotColor={f.color}
          selected={selected.includes(f.slug)}
          onClick={() =>
            onChange(
              selected.includes(f.slug)
                ? selected.filter((s) => s !== f.slug)
                : [...selected, f.slug],
            )
          }
        >
          {f.name}
        </Chip>
      ))}
    </div>
  );
}

interface FilterControlsProps {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  fields: Field[];
  specializations: Specialization[];
  programs: ProgramWithStatus[];
}

const TRI_OPTIONS: { value: TriState; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** The full filter form — rendered in the desktop rail and the mobile filter sheet. */
export function FilterControls({
  filters,
  update,
  fields,
  specializations,
  programs,
}: FilterControlsProps) {
  const fieldIds = useMemo(
    () => new Set(fields.filter((f) => filters.fields.includes(f.slug)).map((f) => f.id)),
    [fields, filters.fields],
  );
  // Only offer specializations that exist in the data, within the chosen fields.
  const usedSpecs = useMemo(
    () => new Set(programs.flatMap((p) => p.specialization_slugs)),
    [programs],
  );
  const specOptions = specializations.filter(
    (s) => usedSpecs.has(s.slug) && (fieldIds.size === 0 || fieldIds.has(s.field_id)),
  );
  const universities = useMemo(
    () =>
      [...new Map(programs.map((p) => [p.university_slug, p.university_name])).entries()].sort(
        (a, b) => a[1].localeCompare(b[1]),
      ),
    [programs],
  );
  const cities = useMemo(() => [...new Set(programs.map((p) => p.city))].sort(), [programs]);

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Field</legend>
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <Chip
              key={f.slug}
              dotColor={f.color}
              selected={filters.fields.includes(f.slug)}
              onClick={() =>
                update({
                  fields: filters.fields.includes(f.slug)
                    ? filters.fields.filter((s) => s !== f.slug)
                    : [...filters.fields, f.slug],
                  specs: [],
                })
              }
            >
              {f.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      {specOptions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Specialization</legend>
          <div className="flex flex-wrap gap-2">
            {specOptions.map((s) => (
              <Chip
                key={s.slug}
                selected={filters.specs.includes(s.slug)}
                onClick={() =>
                  update({
                    specs: filters.specs.includes(s.slug)
                      ? filters.specs.filter((x) => x !== s.slug)
                      : [...filters.specs, s.slug],
                  })
                }
              >
                {s.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Intake"
          value={filters.intake}
          onChange={(e) => update({ intake: e.target.value as Filters['intake'] })}
        >
          <option value="any">Any</option>
          <option value="winter">Winter</option>
          <option value="summer">Summer</option>
        </Select>
        <Select
          label="Teaching language"
          value={filters.lang}
          onChange={(e) => update({ lang: e.target.value as Filters['lang'] })}
        >
          <option value="any">Any</option>
          <option value="english">English</option>
          <option value="german">German</option>
        </Select>
        <Select
          label="Degree"
          value={filters.degrees[0] ?? ''}
          onChange={(e) => update({ degrees: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">Any</option>
          {DEGREE_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 'Other' ? "Master's (degree not stated)" : d}
            </option>
          ))}
        </Select>
        <Select
          label="Max IELTS"
          value={filters.ieltsMax ?? ''}
          onChange={(e) => update({ ieltsMax: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any</option>
          {[5.5, 6, 6.5, 7, 7.5].map((n) => (
            <option key={n} value={n}>
              {n.toFixed(1)} or less
            </option>
          ))}
        </Select>
        <Select
          label="MOI accepted"
          value={filters.moi}
          onChange={(e) => update({ moi: e.target.value as TriState })}
        >
          {TRI_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          label="VPD required"
          value={filters.vpd}
          onChange={(e) => update({ vpd: e.target.value as TriState })}
        >
          {TRI_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          label="NC (restricted)"
          value={filters.nc}
          onChange={(e) => update({ nc: e.target.value as TriState })}
        >
          {TRI_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[rgb(var(--primary))]"
            checked={filters.freeTuition}
            onChange={(e) => update({ freeTuition: e.target.checked })}
          />
          No tuition only
        </label>
      </div>

      <Select
        label="University"
        value={filters.university}
        onChange={(e) => update({ university: e.target.value })}
      >
        <option value="">Any university</option>
        {universities.map(([slug, name]) => (
          <option key={slug} value={slug}>
            {name}
          </option>
        ))}
      </Select>
      <Select label="City" value={filters.city} onChange={(e) => update({ city: e.target.value })}>
        <option value="">Any city</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </div>
  );
}
