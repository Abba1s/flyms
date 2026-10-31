import { slugify } from '@flyms/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/features/admin/api';
import { queryKeys, useFields, useSpecializations } from '@/features/programs/api';
import { supabase } from '@/lib/supabase';

/** Fields are fixed (12); admins manage the specializations inside each field. */
export function TaxonomyAdminPage() {
  const { data: fields = [] } = useFields();
  const { data: specializations = [] } = useSpecializations();
  const [newName, setNewName] = useState<Record<string, string>>({});
  const client = useQueryClient();
  const toast = useToast();

  const refresh = () => void client.invalidateQueries({ queryKey: queryKeys.specializations });

  const add = async (fieldId: string) => {
    const name = (newName[fieldId] ?? '').trim();
    if (!name) return;
    const existing = specializations.filter((s) => s.field_id === fieldId);
    const { error } = await supabase.from('specializations').insert({
      field_id: fieldId,
      slug: slugify(name),
      name,
      sort_order: existing.length + 1,
    });
    if (error) return toast(errorMessage(error));
    setNewName((n) => ({ ...n, [fieldId]: '' }));
    refresh();
    toast(`Added ${name}`);
  };

  const rename = async (id: string, current: string) => {
    const name = window.prompt('Rename specialization', current)?.trim();
    if (!name || name === current) return;
    const { error } = await supabase.from('specializations').update({ name }).eq('id', id);
    if (error) return toast(errorMessage(error));
    refresh();
  };

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Fields & specializations</h1>
      <p className="text-sm text-muted">
        Slugs stay fixed once created, so links and imports keep working. Rename freely.
      </p>
      {fields.map((f) => (
        <section
          key={f.id}
          className="rounded-lg border border-border border-l-4 bg-surface p-4"
          style={{ borderLeftColor: f.color }}
        >
          <h2 className="font-semibold">{f.name}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {specializations
              .filter((s) => s.field_id === f.id)
              .map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void rename(s.id, s.name)}
                    title={`${s.slug} — click to rename`}
                    className="rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-2"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add(f.id);
            }}
          >
            <input
              value={newName[f.id] ?? ''}
              onChange={(e) => setNewName((n) => ({ ...n, [f.id]: e.target.value }))}
              placeholder="New specialization"
              aria-label={`New specialization in ${f.name}`}
              className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm"
            />
            <Button type="submit" size="sm" variant="secondary">
              Add
            </Button>
          </form>
        </section>
      ))}
    </div>
  );
}
