import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { ExplorePage } from '@/pages/ExplorePage';
import { HomePage } from '@/pages/HomePage';
import { MyListPage } from '@/pages/MyListPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProgramPage } from '@/pages/ProgramPage';
import { UniversityPage } from '@/pages/UniversityPage';

/** SOP writer pages load as their own chunk. */
const sop = (name: string) => async () => {
  const mod = (await import('@/pages/sop')) as unknown as Record<string, React.ComponentType>;
  return { Component: mod[name] as React.ComponentType };
};

// Less-visited pages load on demand to keep the first download small.
const children: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: 'explore', element: <ExplorePage /> },
  // The map (Leaflet) is loaded only when visited.
  { path: 'map', lazy: async () => ({ Component: (await import('@/pages/MapPage')).MapPage }) },
  { path: 'programs/:slug', element: <ProgramPage /> },
  { path: 'universities/:slug', element: <UniversityPage /> },
  { path: 'my-list', element: <MyListPage /> },
  {
    path: 'calendar',
    lazy: async () => ({ Component: (await import('@/pages/CalendarPage')).CalendarPage }),
  },
  {
    path: 'costs',
    lazy: async () => ({ Component: (await import('@/pages/CostsPage')).CostsPage }),
  },
  {
    path: 'compare',
    lazy: async () => ({ Component: (await import('@/pages/ComparePage')).ComparePage }),
  },
  { path: 'ask', lazy: async () => ({ Component: (await import('@/pages/AskPage')).AskPage }) },
  {
    path: 'contribute',
    lazy: async () => ({ Component: (await import('@/pages/ContributePage')).ContributePage }),
  },
  { path: 'sop', lazy: sop('SopHomePage') },
  { path: 'sop/new', lazy: sop('SopWizardPage') },
  { path: 'sop/:draftId', lazy: sop('SopEditorPage') },
  { path: 'faq', lazy: async () => ({ Component: (await import('@/pages/FaqPage')).FaqPage }) },
  {
    path: 'settings',
    lazy: async () => ({ Component: (await import('@/pages/SettingsPage')).SettingsPage }),
  },
  {
    path: 'privacy',
    lazy: async () => ({ Component: (await import('@/pages/LegalPages')).PrivacyPage }),
  },
  {
    path: 'about',
    lazy: async () => ({ Component: (await import('@/pages/LegalPages')).AboutPage }),
  },
  { path: '*', element: <NotFoundPage /> },
];

/** Admin pages are a separate chunk; public visitors never download them. */
const admin = (name: string) => async () => {
  const mod = (await import('@/pages/admin')) as unknown as Record<string, React.ComponentType>;
  return { Component: mod[name] as React.ComponentType };
};

const adminRoutes: RouteObject[] = [
  { path: '/admin/login', lazy: admin('AdminLoginPage') },
  {
    path: '/admin',
    lazy: admin('AdminLayout'),
    children: [
      { index: true, lazy: admin('DashboardPage') },
      { path: 'programs', lazy: admin('ProgramsAdminPage') },
      { path: 'programs/new', lazy: admin('ProgramEditorPage') },
      { path: 'programs/:id', lazy: admin('ProgramEditorPage') },
      { path: 'universities', lazy: admin('UniversitiesAdminPage') },
      { path: 'taxonomy', lazy: admin('TaxonomyAdminPage') },
      { path: 'imports', lazy: admin('ImportsAdminPage') },
      { path: 'deadlines', lazy: admin('DeadlinesAdminPage') },
      { path: 'imports/:batchId', lazy: admin('ImportBatchPage') },
      { path: 'queue/changes', lazy: admin('ChangesQueuePage') },
      { path: 'queue/reports', lazy: admin('ReportsQueuePage') },
      { path: 'queue/questions', lazy: admin('QuestionsQueuePage') },
      { path: 'queue/reviews', lazy: admin('ReviewsQueuePage') },
      { path: 'audit', lazy: admin('AuditLogPage') },
    ],
  },
];

const routes: RouteObject[] = [...adminRoutes, { path: '/', element: <AppLayout />, children }];

if (import.meta.env.DEV) {
  routes.unshift({
    path: '/dev/components',
    lazy: async () => ({ Component: (await import('@/pages/dev/ComponentsPage')).ComponentsPage }),
  });
}

export const router = createBrowserRouter(routes);
