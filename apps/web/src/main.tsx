import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/source-serif-4';
import './styles/global.css';

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/Toast';
import { router } from '@/app/router';
import { initAnalytics } from '@/lib/analytics';

initAnalytics();

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
/** Only the dataset needed offline is persisted; everything else is fetched fresh. */
const PERSISTED_KEYS = new Set(['programs', 'fields', 'specializations']);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 60 * 1000, gcTime: ONE_WEEK, retry: 2 } },
});

/** The last dataset is kept in IndexedDB so repeat visits are instant and outages degrade gracefully. */
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).catch(() => null) as Promise<string | null>,
    setItem: (key, value) => set(key, value).catch(() => undefined),
    removeItem: (key) => del(key).catch(() => undefined),
  },
  key: 'flyms-query-cache-v1',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_WEEK,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === 'success' && PERSISTED_KEYS.has(String(q.queryKey[0])),
        },
      }}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
