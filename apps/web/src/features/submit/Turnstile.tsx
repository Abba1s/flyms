import { useCallback, useEffect, useRef, useState } from 'react';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load bot check'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile bot check. Invisible unless Cloudflare needs the visitor to interact.
 * Tokens are single-use: call `reset()` after each submission.
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    SITE_KEY ? null : 'Bot check is not configured',
  );

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetId.current = api.render(containerRef.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          callback: (t: string) => {
            setToken(t);
            setError(null);
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => setError('Bot check failed. Please reload the page.'),
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  // Latest token/error for getToken() without re-creating it on every render.
  const latest = useRef({ token, error });
  latest.current = { token, error };

  /** Resolve with a token, waiting for the widget if the visitor submits before it finishes. */
  const getToken = useCallback(async (timeoutMs = 15_000): Promise<string> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (latest.current.token) return latest.current.token;
      if (latest.current.error) throw new Error(latest.current.error);
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('The bot check is taking too long. Please reload the page and try again.');
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  const widget = <div ref={containerRef} className="empty:hidden" />;
  return { widget, token, error, reset, getToken };
}
