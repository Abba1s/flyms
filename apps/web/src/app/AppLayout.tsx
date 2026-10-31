import { useState, type ComponentType, type SVGProps } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { CompareBar } from '@/features/compare/CompareToggle';
import {
  BookmarkIcon,
  CalendarIcon,
  ChatIcon,
  CompareIcon,
  EuroIcon,
  HelpIcon,
  ListIcon,
  MapIcon,
  MoonIcon,
  MoreIcon,
  PlaneIcon,
  PenIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from '@/components/icons';
import { cn } from '@/lib/cn';
import { useOnline } from '@/lib/pwa';
import { useTheme } from '@/lib/theme';
import { useLocalStore } from '@/stores/local';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const primaryNav: NavItem[] = [
  { to: '/explore', label: 'Explore', icon: ListIcon },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/my-list', label: 'My List', icon: BookmarkIcon },
  { to: '/sop', label: 'SOP', icon: PenIcon },
];
const secondaryNav: NavItem[] = [
  { to: '/calendar', label: 'Deadlines', icon: CalendarIcon },
  { to: '/compare', label: 'Compare', icon: CompareIcon },
  { to: '/costs', label: 'Cost estimator', icon: EuroIcon },
  { to: '/contribute', label: 'Contribute', icon: PlusIcon },
  { to: '/ask', label: 'Ask a question', icon: ChatIcon },
  { to: '/faq', label: 'FAQ & glossary', icon: HelpIcon },
  { to: '/settings', label: 'Settings & backup', icon: SettingsIcon },
];

function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 font-display text-sm font-bold leading-tight tracking-tight"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-contrast">
        <PlaneIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="max-w-[11rem]">Universal Travel and Education Consultancy</span>
    </Link>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={cn(
        'grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text',
        className,
      )}
    >
      <SunIcon className="theme-icon-sun h-5 w-5" />
      <MoonIcon className="theme-icon-moon h-5 w-5" />
    </button>
  );
}

function SavedCount() {
  const count = useLocalStore((s) => s.saved.length);
  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary/12 px-2 text-xs font-semibold tabular-nums text-primary">
      {count}
    </span>
  );
}

function SideNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium',
          isActive ? 'bg-primary/12 text-primary' : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      <item.icon className="h-5 w-5" />
      {item.label}
      {item.to === '/my-list' && <SavedCount />}
    </NavLink>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
      }}
    >
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search programs, universities, cities"
        aria-label="Search programs"
        className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
      />
    </form>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p
      role="status"
      className="bg-st-closing/12 px-4 py-2 text-center text-sm font-medium text-st-closing"
    >
      You’re offline. Showing saved programs and your local data — new searches, submissions and the
      SOP writer need a connection.
    </p>
  );
}

export function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith('/map');

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-contrast focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <SideNavLink key={item.to} item={item} />
          ))}
        </nav>
        <nav aria-label="More" className="mt-auto flex flex-col gap-1">
          {secondaryNav.map((item) => (
            <SideNavLink key={item.to} item={item} />
          ))}
          <div className="flex gap-3 px-3 pt-2 text-xs text-muted">
            <Link to="/about" className="hover:text-text hover:underline">
              About
            </Link>
            <Link to="/privacy" className="hover:text-text hover:underline">
              Privacy
            </Link>
          </div>
          <div className="flex items-center justify-between px-3 text-xs text-muted">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur md:h-16 md:px-6">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="hidden flex-1 md:block">
            <HeaderSearch />
          </div>
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <Link
              to="/explore"
              aria-label="Search programs"
              className="grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-surface-2"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <OfflineBanner />
        {!fullBleed && <CompareBar />}
        <main
          id="main"
          className={cn('flex-1 pb-20 md:pb-0', fullBleed ? '' : 'px-4 py-6 md:px-8 md:py-8')}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 text-xs font-medium',
                isActive ? 'text-primary' : 'text-muted',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted"
        >
          <MoreIcon className="h-5 w-5" />
          More
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="More" variant="sheet">
        <div className="flex flex-col gap-1" onClick={() => setMoreOpen(false)}>
          {secondaryNav.map((item) => (
            <SideNavLink key={item.to} item={item} />
          ))}
          <div className="flex gap-4 px-3 pt-3 text-sm text-muted">
            <Link to="/about" className="hover:underline">
              About
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
