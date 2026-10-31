import type { SopLength, SopSectionId, SopTemplateId } from '@flyms/shared';
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from './local';

export interface SopSection {
  id: SopSectionId;
  title: string;
  text: string;
}

export interface SopVersion {
  id: string;
  createdAt: string;
  label: string;
  sections: SopSection[];
}

export interface SopDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  template: SopTemplateId;
  fieldSlug: string;
  fieldName: string;
  specializationSlug: string;
  specializationName: string;
  programId: string | null;
  programName: string | null;
  answers: Record<string, string>;
  length: SopLength;
  /** The editable letter; empty until the first generation. */
  sections: SopSection[];
  versions: SopVersion[];
}

export const sopDraftSchema: z.ZodType<SopDraft> = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  template: z.string(),
  fieldSlug: z.string(),
  fieldName: z.string(),
  specializationSlug: z.string(),
  specializationName: z.string(),
  programId: z.string().nullable(),
  programName: z.string().nullable(),
  answers: z.record(z.string()),
  length: z.enum(['short', 'standard', 'long']),
  sections: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })),
  versions: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      label: z.string(),
      sections: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })),
    }),
  ),
}) as unknown as z.ZodType<SopDraft>;

const MAX_VERSIONS = 15;
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface SopState {
  drafts: Record<string, SopDraft>;
  createDraft: (
    init: Omit<SopDraft, 'id' | 'createdAt' | 'updatedAt' | 'sections' | 'versions'>,
  ) => string;
  updateDraft: (id: string, patch: Partial<Omit<SopDraft, 'id' | 'createdAt'>>) => void;
  setSectionText: (id: string, sectionId: SopSectionId, text: string) => void;
  /** Snapshot the current letter as a version (keeps the latest 15). */
  saveVersion: (id: string, label: string) => void;
  restoreVersion: (id: string, versionId: string) => void;
  deleteDraft: (id: string) => void;
  replaceAll: (drafts: Record<string, SopDraft>) => void;
}

export const useSopStore = create<SopState>()(
  persist(
    (set, get) => ({
      drafts: {},
      createDraft: (init) => {
        const id = newId();
        const now = new Date().toISOString();
        set((s) => ({
          drafts: {
            ...s.drafts,
            [id]: { ...init, id, createdAt: now, updatedAt: now, sections: [], versions: [] },
          },
        }));
        return id;
      },
      updateDraft: (id, patch) =>
        set((s) => {
          const d = s.drafts[id];
          if (!d) return s;
          return {
            drafts: { ...s.drafts, [id]: { ...d, ...patch, updatedAt: new Date().toISOString() } },
          };
        }),
      setSectionText: (id, sectionId, text) => {
        const d = get().drafts[id];
        if (!d) return;
        get().updateDraft(id, {
          sections: d.sections.map((sec) => (sec.id === sectionId ? { ...sec, text } : sec)),
        });
      },
      saveVersion: (id, label) => {
        const d = get().drafts[id];
        if (!d || d.sections.length === 0) return;
        const version: SopVersion = {
          id: newId(),
          createdAt: new Date().toISOString(),
          label,
          sections: d.sections.map((s) => ({ ...s })),
        };
        get().updateDraft(id, { versions: [version, ...d.versions].slice(0, MAX_VERSIONS) });
      },
      restoreVersion: (id, versionId) => {
        const d = get().drafts[id];
        const v = d?.versions.find((x) => x.id === versionId);
        if (!d || !v) return;
        get().saveVersion(id, 'Before restoring');
        get().updateDraft(id, { sections: v.sections.map((s) => ({ ...s })) });
      },
      deleteDraft: (id) =>
        set((s) => {
          const rest = { ...s.drafts };
          delete rest[id];
          return { drafts: rest };
        }),
      replaceAll: (drafts) => set({ drafts }),
    }),
    {
      name: 'flyms-sop-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
);
