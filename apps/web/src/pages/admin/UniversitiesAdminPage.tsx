import { slugify } from '@flyms/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  adminKeys,
  errorMessage,
  useAdminUniversities,
  type UniversityRow,
} from '@/features/admin/api';
import { queryKeys } from '@/features/programs/api';
import { supabase } from '@/lib/supabase';

const TYPES = [
  ['university', 'University'],
  ['technical_university', 'Technical university'],
  ['university_applied_sciences', 'University of applied sciences'],
  ['art_music', 'Art / music college'],
  ['other', 'Other'],
] as const;

type Draft = Omit<UniversityRow, 'id' | 'deleted_at' | 'lat' | 'lng' | 'qs_ranking_sort'> & {
  id?: string;
  lat: string;
  lng: string;
};

const blank: Draft = {
  slug: '',
  name: '',
  short_name: '',
  type: 'university',
  city: '',
  state: '',
  lat: '',
  lng: '',
  website: '',
  qs_ranking: '',
};

export function UniversitiesAdminPage() {
  const { data: universities = [] } = useAdminUniversities();
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const client = useQueryClient();
  const toast = useToast();

  const rows = universities.filter((u) =>
    `${u.name} ${u.city}`.toLowerCase().includes(q.toLowerCase()),
  );

  const save = async () => {
    if (!draft) return;
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (!draft.name || !draft.city || !draft.state || Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Name, city, state and coordinates are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const qsSort = Number.parseInt(draft.qs_ranking ?? '', 10);
    const row = {
      slug: draft.slug || slugify(draft.name),
      name: draft.name.trim(),
      short_name: draft.short_name || null,
      type: draft.type,
      city: draft.city.trim(),
      state: draft.state.trim(),
      lat,
      lng,
      website: draft.website || null,
      qs_ranking: draft.qs_ranking || null,
      qs_ranking_sort: Number.isNaN(qsSort) ? null : qsSort,
    };
    const { error: err } = draft.id
      ? await supabase.from('universities').update(row).eq('id', draft.id)
      : await supabase.from('universities').insert(row);
    setSaving(false);
    if (err) return setError(errorMessage(err));
    void client.invalidateQueries({ queryKey: adminKeys.universities });
    void client.invalidateQueries({ queryKey: queryKeys.programs });
    toast(draft.id ? 'University updated' : 'University added');
    setDraft(null);
  };

  const field = (key: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <Input
      label={label}
      value={(draft?.[key] as string | null) ?? ''}
      onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
      {...props}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Universities</h1>
        <Button onClick={() => setDraft(blank)}>Add university</Button>
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        aria-label="Search universities"
        className="h-10 w-72 rounded-md border border-border bg-surface px-3 text-sm"
      />
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div>
              <p className="font-medium">{u.name}</p>
              <p className="text-sm text-muted">
                {u.city}, {u.state} {u.qs_ranking && `· QS ${u.qs_ranking}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft({
                  ...u,
                  lat: String(u.lat),
                  lng: String(u.lng),
                  short_name: u.short_name ?? '',
                  website: u.website ?? '',
                  qs_ranking: u.qs_ranking ?? '',
                })
              }
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? 'Edit university' : 'Add university'}
        footer={
          <>
            {error && <p className="mr-auto text-sm text-danger">{error}</p>}
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {field('name', 'Name')}
          {field('short_name', 'Short name')}
          <Select
            label="Type"
            value={draft?.type ?? 'university'}
            onChange={(e) => setDraft((d) => (d ? { ...d, type: e.target.value } : d))}
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          {field('slug', 'Slug', { placeholder: draft?.name ? slugify(draft.name) : '' })}
          {field('city', 'City')}
          {field('state', 'State (Bundesland)')}
          {field('lat', 'Latitude', { inputMode: 'decimal', placeholder: '52.5122' })}
          {field('lng', 'Longitude', { inputMode: 'decimal', placeholder: '13.3270' })}
          {field('qs_ranking', 'QS ranking', { placeholder: '151-200' })}
          {field('website', 'Website', { type: 'url' })}
        </div>
      </Dialog>
    </div>
  );
}
