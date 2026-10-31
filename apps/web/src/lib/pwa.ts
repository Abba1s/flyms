import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  event: BeforeInstallPromptEvent | null;
  installed: boolean;
}

/** Holds the browser's install prompt so a button can trigger it later. */
export const useInstallStore = create<InstallState>(() => ({
  event: null,
  installed:
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstallStore.setState({ event: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    useInstallStore.setState({ event: null, installed: true }),
  );
}

export async function promptInstall(): Promise<boolean> {
  const { event } = useInstallStore.getState();
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  useInstallStore.setState({ event: null });
  return outcome === 'accepted';
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
