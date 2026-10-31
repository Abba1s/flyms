import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import { useIsAdmin, useQueueCounts, useSession } from './api';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/programs', label: 'Programs' },
  { to: '/admin/universities', label: 'Universities' },
  { to: '/admin/taxonomy', label: 'Fields' },
  { to: '/admin/imports', label: 'Imports' },
  { to: '/admin/queue/changes', label: 'Change requests', count: 'changes' as const },
  { to: '/admin/queue/reports', label: 'Reports', count: 'reports' as const },
  { to: '/admin/queue/questions', label: 'Questions', count: 'questions' as const },
  { to: '/admin/queue/reviews', label: 'Reviews', count: 'reviews' as const },
  { to: '/admin/audit', label: 'Audit log' },
];

function Nav() {
  const { data: counts } = useQueueCounts();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium',
              isActive
                ? 'bg-primary/12 text-primary'
                : 'text-muted hover:bg-surface-2 hover:text-text',
            )
          }
        >
          {item.label}
          {item.count && (counts?.[item.count] ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-st-closing/15 px-2 text-xs font-semibold tabular-nums text-st-closing">
              {counts?.[item.count]}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Admin shell. RLS enforces access server-side; this guard only decides what to render. */
export function AdminLayout() {
  const session = useSession();
  const { data: isAdmin, isPending } = useIsAdmin(session);
  const location = useLocation();

  if (session === undefined || (session && isPending)) {
    return <p className="p-8 text-muted">Checking access…</p>;
  }
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3 p-8">
        <h1 className="text-xl font-bold">Access denied</h1>
        <p className="text-muted">This account is not an admin.</p>
        <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:flex">
      <aside className="flex flex-col gap-4 border-b border-border bg-surface p-3 md:sticky md:top-0 md:h-dvh md:w-56 md:border-b-0 md:border-r md:p-4">
        <div className="flex items-center justify-between">
          <Link to="/admin" className="font-display font-bold">
            FlyMS Admin
          </Link>
          <Link to="/" className="text-xs text-muted hover:underline md:hidden">
            View site
          </Link>
        </div>
        <Nav />
        <div className="mt-auto hidden flex-col gap-2 text-xs text-muted md:flex">
          <span className="truncate">{session.user.email}</span>
          <Link to="/" className="hover:underline">
            View site
          </Link>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="text-left hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
