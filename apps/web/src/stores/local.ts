import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { z } from 'zod';

/** localStorage that degrades to in-memory when storage is blocked (private mode, policies). */
const memory = new Map<string, string>();
export let storageAvailable = true;
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      storageAvailable = false;
      return memory.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      storageAvailable = false;
      memory.set(name, value);
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      memory.delete(name);
    }
  },
};

export const savedItemSchema = z.object({ id: z.string(), savedAt: z.string() });
export type SavedItem = z.infer<typeof savedItemSchema>;

export const trackerStatuses = [
  'researching',
  'preparing',
  'applied',
  'interview',
  'admitted',
  'rejected',
  'withdrawn',
] as const;
export type TrackerStatus = (typeof trackerStatuses)[number];

export const trackerEntrySchema = z.object({
  status: z.enum(trackerStatuses),
  checklist: z.record(z.boolean()),
  notes: z.string(),
});
export type TrackerEntry = z.infer<typeof trackerEntrySchema>;

export const localDataSchema = z.object({
  saved: z.array(savedItemSchema),
  dismissedBanners: z.array(z.string()),
  tracker: z.record(trackerEntrySchema).default({}),
  compareIds: z.array(z.string()).default([]),
});
export type LocalData = z.infer<typeof localDataSchema>;

export const MAX_COMPARE = 4;
const defaultEntry = (): TrackerEntry => ({ status: 'researching', checklist: {}, notes: '' });

interface LocalState extends LocalData {
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => boolean;
  dismissBanner: (key: string) => void;
  /** Tracker entry for a saved program (defaults to "researching"). */
  entry: (id: string) => TrackerEntry;
  updateEntry: (id: string, patch: Partial<TrackerEntry>) => void;
  toggleChecklist: (id: string, itemId: string) => void;
  /** Returns false when the compare list is full. */
  toggleCompare: (id: string) => boolean;
  clearCompare: () => void;
  replaceAll: (data: LocalData) => void;
  mergeIn: (data: LocalData) => void;
  clearAll: () => void;
}

const empty: LocalData = { saved: [], dismissedBanners: [], tracker: {}, compareIds: [] };

export const useLocalStore = create<LocalState>()(
  persist(
    (set, get) => ({
      ...empty,
      isSaved: (id) => get().saved.some((s) => s.id === id),
      toggleSaved: (id) => {
        const wasSaved = get().isSaved(id);
        set((s) => ({
          saved: wasSaved
            ? s.saved.filter((x) => x.id !== id)
            : [...s.saved, { id, savedAt: new Date().toISOString() }],
        }));
        return !wasSaved;
      },
      dismissBanner: (key) =>
        set((s) => ({ dismissedBanners: [...new Set([...s.dismissedBanners, key])] })),
      entry: (id) => get().tracker[id] ?? defaultEntry(),
      updateEntry: (id, patch) =>
        set((s) => ({
          tracker: { ...s.tracker, [id]: { ...(s.tracker[id] ?? defaultEntry()), ...patch } },
        })),
      toggleChecklist: (id, itemId) => {
        const e = get().entry(id);
        get().updateEntry(id, { checklist: { ...e.checklist, [itemId]: !e.checklist[itemId] } });
      },
      toggleCompare: (id) => {
        const ids = get().compareIds;
        if (ids.includes(id)) {
          set({ compareIds: ids.filter((x) => x !== id) });
          return true;
        }
        if (ids.length >= MAX_COMPARE) return false;
        set({ compareIds: [...ids, id] });
        return true;
      },
      clearCompare: () => set({ compareIds: [] }),
      replaceAll: (data) => set(data),
      mergeIn: (data) =>
        set((s) => {
          const ids = new Set(s.saved.map((x) => x.id));
          return {
            saved: [...s.saved, ...data.saved.filter((x) => !ids.has(x.id))],
            dismissedBanners: [...new Set([...s.dismissedBanners, ...data.dismissedBanners])],
            // Existing tracker entries win; new ones are added.
            tracker: { ...data.tracker, ...s.tracker },
            compareIds: s.compareIds,
          };
        }),
      clearAll: () => set(empty),
    }),
    {
      name: 'flyms-local-v1',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): LocalData => ({
        saved: s.saved,
        dismissedBanners: s.dismissedBanners,
        tracker: s.tracker,
        compareIds: s.compareIds,
      }),
      // v1 → v2 added the tracker and compare list.
      migrate: (persisted) => ({ ...empty, ...(persisted as Partial<LocalData>) }),
    },
  ),
);

/** Versioned backup file format for Settings → export/import (v1 files are still accepted). */
export const backupSchema = z.object({
  app: z.literal('flyms'),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  data: localDataSchema,
  sopDrafts: z.record(z.unknown()).optional(),
});

export function buildBackup(data: LocalData, sopDrafts: Record<string, unknown>) {
  return {
    app: 'flyms' as const,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    data,
    sopDrafts,
  };
}
