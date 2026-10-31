/**
 * Cookie-less, privacy-friendly analytics (Plausible-compatible). Disabled unless
 * VITE_PLAUSIBLE_DOMAIN is set. Events never carry personal data or free text.
 */
type EventName =
  | 'Program Save'
  | 'List Export'
  | 'SOP Generate'
  | 'SOP Export'
  | 'Submission'
  | 'Calendar Export'
  | 'App Install';

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: Record<string, string | number> }) => void) & {
      q?: unknown[];
    };
  }
}

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC =
  (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) || 'https://plausible.io/js/script.js';

export function initAnalytics() {
  if (!DOMAIN || typeof document === 'undefined') return;
  // Queue events fired before the script loads.
  window.plausible ??= Object.assign(
    (...args: unknown[]) => {
      (window.plausible!.q ??= []).push(args);
    },
    { q: [] as unknown[] },
  );
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = DOMAIN;
  script.src = SRC;
  document.head.appendChild(script);
}

export function track(event: EventName, props?: Record<string, string | number>) {
  if (!DOMAIN) return;
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    // Analytics must never break the app.
  }
}
