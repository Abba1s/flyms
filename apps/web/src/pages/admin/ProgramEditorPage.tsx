import { applicationPortals, degreeTypes, programSlug, teachingLanguages } from '@flyms/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  errorMessage,
  useAdminProgram,
  useAdminRpc,
  useAdminUniversities,
  type AdminProgram,
} from '@/features/admin/api';
import { academicYear, type IntakeRow } from '@/features/admin/proposal';
import { useFields, useSpecializations } from '@/features/programs/api';
import { LANGUAGE_LABEL, PORTAL_LABEL } from '@/features/programs/labels';
import { formatDate } from '@/lib/format';
import { useToday } from '@/lib/useToday';

type TriValue = '' | 'true' | 'false';

interface FormState {
  name: string;
  slug: string;
  university_id: string;
  field_id: string;
  degree_type: string;
  teaching_language: string;
  duration_semesters: string;
  ects: string;
  official_url: string;
  application_url: string;
  application_portal: string;
  tuition_fee_eur: string;
  tuition_note: string;
  semester_contribution_eur: string;
  application_fee_eur: string;
  ielts_min: string;
  toefl_min: string;
  english_note: string;
  german_level: string;
  moi_accepted: TriValue;
  vpd_required: TriValue;
  aps_required: TriValue;
  nc_restricted: TriValue;
  gre_gmat: string;
  entrance_exam_interview: string;
  portfolio_required: boolean;
  work_experience_years: string;
  min_gpa_note: string;
  summary: string;
  letter_note: string;
  source_url: string;
  last_verified_at: string;
}

const EMPTY: FormState = {
  name: '',
  slug: '',
  university_id: '',
  field_id: '',
  degree_type: 'MSc',
  teaching_language: 'english',
  duration_semesters: '',
  ects: '',
  official_url: '',
  application_url: '',
  application_portal: '',
  tuition_fee_eur: '',
  tuition_note: '',
  semester_contribution_eur: '',
  application_fee_eur: '',
  ielts_min: '',
  toefl_min: '',
  english_note: '',
  german_level: '',
  moi_accepted: '',
  vpd_required: '',
  aps_required: '',
  nc_restricted: '',
  gre_gmat: '',
  entrance_exam_interview: '',
  portfolio_required: false,
  work_experience_years: '',
  min_gpa_note: '',
  summary: '',
  letter_note: '',
  source_url: '',
  last_verified_at: '',
};

const NUMBER_KEYS = [
  'duration_semesters',
  'ects',
  'tuition_fee_eur',
  'semester_contribution_eur',
  'application_fee_eur',
  'ielts_min',
  'toefl_min',
  'work_experience_years',
] as const;
const TRI_KEYS = ['moi_accepted', 'vpd_required', 'aps_required', 'nc_restricted'] as const;

function fromProgram(p: AdminProgram): FormState {
  const out = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof FormState)[]) {
    const v = p[key];
    if (key === 'portfolio_required') out.portfolio_required = Boolean(v);
    else if ((TRI_KEYS as readonly string[]).includes(key))
      (out[key] as TriValue) = v === null ? '' : v ? 'true' : 'false';
    else (out[key] as string) = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

function toPayload(f: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(f)) {
    if ((NUMBER_KEYS as readonly string[]).includes(key))
      payload[key] = value === '' ? null : Number(value);
    else if ((TRI_KEYS as readonly string[]).includes(key))
      payload[key] = value === '' ? null : value === 'true';
    else if (typeof value === 'string') payload[key] = value.trim() === '' ? null : value.trim();
    else payload[key] = value;
  }
  return payload;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="rounded-sm border border-border bg-surface px-3 py-2 font-normal focus:border-primary focus:outline-none"
      />
    </label>
  );
}

export function ProgramEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { data: program, isPending } = useAdminProgram(isNew ? undefined : id);
  const { data: universities = [] } = useAdminUniversities();
  const { data: fields = [] } = useFields();
  const { data: specializations = [] } = useSpecializations();
  const navigate = useNavigate();
  const toast = useToast();
  const today = useToday();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [specIds, setSpecIds] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<{ kind: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    setForm(fromProgram(program));
    setIntakes(
      program.program_intakes.map(
        ({ season, academic_year, application_start, application_end, eu_end, note }) => ({
          season,
          academic_year,
          application_start,
          application_end,
          eu_end,
          note,
        }),
      ),
    );
    setSpecIds(program.program_specializations.map((s) => s.specialization_id));
    setHighlights(
      [...program.program_highlights]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ kind, text }) => ({ kind, text })),
    );
  }, [program]);

  const upsert = useAdminRpc<{ payload: Record<string, unknown> }, string>('admin_upsert_program');
  const verify = useAdminRpc<{ p_id: string }>('admin_mark_verified');
  const remove = useAdminRpc<{ p_id: string }>('admin_soft_delete_program');
  const restore = useAdminRpc<{ p_id: string }>('admin_restore_program');

  const set =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  const uni = universities.find((u) => u.id === form.university_id);
  const suggestedSlug = uni && form.name ? programSlug(uni.slug, form.name, form.degree_type) : '';
  const fieldSpecs = useMemo(
    () => specializations.filter((s) => s.field_id === form.field_id),
    [specializations, form.field_id],
  );

  const save = async (state: 'draft' | 'published') => {
    setError(null);
    if (!form.name || !form.university_id || !form.field_id || !form.official_url) {
      setError('Name, university, field and official URL are required.');
      return;
    }
    try {
      const newId = await upsert.mutateAsync({
        payload: {
          ...toPayload(form),
          ...(isNew ? {} : { id }),
          slug: form.slug.trim() || suggestedSlug,
          state,
          intakes: intakes.filter((i) => i.academic_year),
          specialization_ids: specIds,
          highlights: highlights.filter((h) => h.text.trim()),
        },
      });
      toast(state === 'published' ? 'Saved and published' : 'Saved as draft');
      if (isNew) navigate(`/admin/programs/${newId}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!isNew && isPending) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex max-w-4xl flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/programs" className="text-sm text-muted hover:underline">
            ← Programs
          </Link>
          <h1 className="text-2xl font-bold">{isNew ? 'New program' : form.name || 'Program'}</h1>
          {program && (
            <p className="text-sm text-muted">
              {program.state} · verified{' '}
              {program.last_verified_at ? formatDate(String(program.last_verified_at)) : 'never'}
              {program.deleted_at && ' · deleted'}
              {program.state === 'published' && !program.deleted_at && (
                <>
                  {' · '}
                  <Link to={`/programs/${program.slug}`} className="text-primary hover:underline">
                    View public page
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        {!isNew && program && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                void verify
                  .mutateAsync({ p_id: program.id })
                  .then(() => toast('Marked as verified today'))
              }
            >
              Mark verified today
            </Button>
            {program.deleted_at ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void restore.mutateAsync({ p_id: program.id }).then(() => toast('Restored'))
                }
              >
                Restore
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() =>
                  void remove
                    .mutateAsync({ p_id: program.id })
                    .then(() => toast('Deleted — it can be restored'))
                }
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Program name" value={form.name} onChange={set('name')} required />
          <Select
            label="University"
            value={form.university_id}
            onChange={set('university_id')}
            required
          >
            <option value="">Choose…</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select
            label="Field"
            value={form.field_id}
            onChange={(e) => {
              setForm((f) => ({ ...f, field_id: e.target.value }));
              setSpecIds([]);
            }}
            required
          >
            <option value="">Choose…</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select label="Degree" value={form.degree_type} onChange={set('degree_type')}>
            {degreeTypes.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select
            label="Teaching language"
            value={form.teaching_language}
            onChange={set('teaching_language')}
          >
            {teachingLanguages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABEL[l]}
              </option>
            ))}
          </Select>
          <Input
            label="Slug"
            value={form.slug}
            onChange={set('slug')}
            placeholder={suggestedSlug}
            hint="Leave empty to use the suggestion."
          />
          <Input
            label="Duration (semesters)"
            type="number"
            value={form.duration_semesters}
            onChange={set('duration_semesters')}
          />
          <Input label="ECTS" type="number" value={form.ects} onChange={set('ects')} />
        </div>
        {fieldSpecs.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Specializations</legend>
            <div className="flex flex-wrap gap-2">
              {fieldSpecs.map((s) => (
                <Chip
                  key={s.id}
                  selected={specIds.includes(s.id)}
                  onClick={() =>
                    setSpecIds((ids) =>
                      ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id],
                    )
                  }
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        <Textarea
          label="Summary"
          value={form.summary}
          onChange={(v) => setForm((f) => ({ ...f, summary: v }))}
          rows={2}
        />
      </Section>

      <Section title="Application windows">
        {intakes.map((intake, i) => (
          <div
            key={i}
            className="grid items-end gap-3 rounded-md border border-border p-3 sm:grid-cols-[110px_110px_1fr_1fr_auto]"
          >
            <Select
              label="Season"
              value={intake.season}
              onChange={(e) =>
                setIntakes((all) =>
                  all.map((x, j) =>
                    j === i ? { ...x, season: e.target.value as IntakeRow['season'] } : x,
                  ),
                )
              }
            >
              <option value="winter">Winter</option>
              <option value="summer">Summer</option>
            </Select>
            <Input
              label="Year"
              value={intake.academic_year}
              onChange={(e) =>
                setIntakes((all) =>
                  all.map((x, j) => (j === i ? { ...x, academic_year: e.target.value } : x)),
                )
              }
            />
            <Input
              label="Opens"
              type="date"
              value={intake.application_start ?? ''}
              onChange={(e) =>
                setIntakes((all) =>
                  all.map((x, j) =>
                    j === i ? { ...x, application_start: e.target.value || null } : x,
                  ),
                )
              }
            />
            <Input
              label="Deadline"
              type="date"
              value={intake.application_end ?? ''}
              onChange={(e) =>
                setIntakes((all) =>
                  all.map((x, j) =>
                    j === i ? { ...x, application_end: e.target.value || null } : x,
                  ),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() => setIntakes((all) => all.filter((_, j) => j !== i))}
              aria-label="Remove intake"
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() =>
            setIntakes((all) => [
              ...all,
              {
                season: 'winter',
                academic_year: academicYear('winter', undefined, today),
                application_start: null,
                application_end: null,
              },
            ])
          }
        >
          Add intake
        </Button>
      </Section>

      <Section title="Requirements">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Minimum IELTS"
            type="number"
            step="0.5"
            value={form.ielts_min}
            onChange={set('ielts_min')}
          />
          <Input
            label="Minimum TOEFL iBT"
            type="number"
            value={form.toefl_min}
            onChange={set('toefl_min')}
          />
          <Input
            label="English note"
            value={form.english_note}
            onChange={set('english_note')}
            placeholder="e.g. B2 / C1"
          />
          <Input
            label="German level"
            value={form.german_level}
            onChange={set('german_level')}
            placeholder="none, B2, DSH-2…"
          />
          {TRI_KEYS.map((key) => (
            <Select
              key={key}
              label={
                {
                  moi_accepted: 'MOI accepted',
                  vpd_required: 'VPD required',
                  aps_required: 'APS required',
                  nc_restricted: 'NC restricted',
                }[key]
              }
              value={form[key]}
              onChange={set(key)}
            >
              <option value="">Not stated</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          ))}
          <Input label="GRE / GMAT" value={form.gre_gmat} onChange={set('gre_gmat')} />
          <Input
            label="Entrance test / interview"
            value={form.entrance_exam_interview}
            onChange={set('entrance_exam_interview')}
          />
          <Input
            label="Work experience (years)"
            type="number"
            value={form.work_experience_years}
            onChange={set('work_experience_years')}
          />
          <Input
            label="Grade requirement"
            value={form.min_gpa_note}
            onChange={set('min_gpa_note')}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.portfolio_required}
            onChange={(e) => setForm((f) => ({ ...f, portfolio_required: e.target.checked }))}
          />
          Portfolio required
        </label>
        <Input
          label="Letter requirement"
          value={form.letter_note}
          onChange={set('letter_note')}
          placeholder="e.g. Motivation letter, max 2 pages"
        />
      </Section>

      <Section title="Costs & links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Tuition per semester (€)"
            type="number"
            value={form.tuition_fee_eur}
            onChange={set('tuition_fee_eur')}
            hint="0 = no tuition"
          />
          <Input label="Tuition note" value={form.tuition_note} onChange={set('tuition_note')} />
          <Input
            label="Semester contribution (€)"
            type="number"
            value={form.semester_contribution_eur}
            onChange={set('semester_contribution_eur')}
          />
          <Input
            label="Application fee (€)"
            type="number"
            value={form.application_fee_eur}
            onChange={set('application_fee_eur')}
          />
          <Select
            label="Apply via"
            value={form.application_portal}
            onChange={set('application_portal')}
          >
            <option value="">Not stated</option>
            {applicationPortals.map((p) => (
              <option key={p} value={p}>
                {PORTAL_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Official page URL"
          type="url"
          value={form.official_url}
          onChange={set('official_url')}
          required
        />
        <Input
          label="Application URL"
          type="url"
          value={form.application_url}
          onChange={set('application_url')}
        />
        <Input
          label="Source used for verification"
          type="url"
          value={form.source_url}
          onChange={set('source_url')}
        />
        <Input
          label="Last verified"
          type="date"
          value={form.last_verified_at}
          onChange={set('last_verified_at')}
        />
      </Section>

      <Section title="Highlights">
        {highlights.map((h, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[160px_1fr_auto]">
            <Select
              label="Kind"
              value={h.kind}
              onChange={(e) =>
                setHighlights((all) =>
                  all.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)),
                )
              }
            >
              <option value="module">Module</option>
              <option value="lab">Lab</option>
              <option value="research_group">Research group</option>
              <option value="feature">Feature</option>
            </Select>
            <Input
              label="Text"
              value={h.text}
              onChange={(e) =>
                setHighlights((all) =>
                  all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                )
              }
            />
            <Button
              variant="ghost"
              onClick={() => setHighlights((all) => all.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setHighlights((all) => [...all, { kind: 'module', text: '' }])}
        >
          Add highlight
        </Button>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:left-56">
        {error && (
          <p role="alert" className="mr-auto text-sm text-danger">
            {error}
          </p>
        )}
        <Button variant="secondary" disabled={upsert.isPending} onClick={() => void save('draft')}>
          Save draft
        </Button>
        <Button disabled={upsert.isPending} onClick={() => void save('published')}>
          {upsert.isPending ? 'Saving…' : 'Save & publish'}
        </Button>
      </div>
    </div>
  );
}
