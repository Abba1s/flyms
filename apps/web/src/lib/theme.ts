import { useEffect, useState } from 'react';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'flyms-theme';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage blocked: the theme still applies for this session.
  }
}

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

/** One shared theme state, so the header toggle and Settings stay in sync. */
export const useTheme = create<ThemeState>((set, get) => ({
  preference: readPreference(),
  setPreference: (preference) => {
    apply(preference);
    set({ preference });
  },
  toggle: () => {
    const { preference, setPreference } = get();
    const dark = preference === 'system' ? darkQuery().matches : preference === 'dark';
    setPreference(dark ? 'light' : 'dark');
  },
}));

/** Whether dark colours are currently in effect (explicit choice or system setting). */
export function useIsDark(): boolean {
  const preference = useTheme((s) => s.preference);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    const media = darkQuery();
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return preference === 'system' ? systemDark : preference === 'dark';
}
