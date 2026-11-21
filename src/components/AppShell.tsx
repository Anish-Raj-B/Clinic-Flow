import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { APP_CONFIG } from '../lib/config';
import { cn, getErrorMessage, initials, ROLE_LABELS } from '../lib/utils';
import type { UserRole } from '../types/database';
import { Logo } from './Logo';
import { RoleBadge } from './ui';
import {
  AlertIcon,
  CalendarIcon,
  ChartIcon,
  CloseIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  UsersIcon,
  BoxIcon,
  type IconProps,
} from './icons';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  roles: UserRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', icon: HomeIcon, roles: ['staff', 'owner'] },
      { to: '/app/book', label: 'Book appointment', icon: CalendarIcon, roles: ['customer'] },
      {
        to: '/app/my-appointments',
        label: 'My appointments',
        icon: CalendarIcon,
        roles: ['customer'],
      },
      { to: '/app/appointments', label: 'Appointments', icon: CalendarIcon, roles: ['staff', 'owner'] },
      { to: '/app/inventory', label: 'Inventory', icon: BoxIcon, roles: ['staff', 'owner'] },
      { to: '/app/invoices', label: 'My invoices', icon: ReceiptIcon, roles: ['customer'] },
      { to: '/app/billing', label: 'Billing', icon: ReceiptIcon, roles: ['staff', 'owner'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/app/services', label: 'Services', icon: SettingsIcon, roles: ['owner'] },
      { to: '/app/staff', label: 'Staff & roles', icon: UsersIcon, roles: ['owner'] },
      { to: '/app/analytics', label: 'Analytics', icon: ChartIcon, roles: ['owner'] },
      { to: '/app/audit-logs', label: 'Audit logs', icon: ShieldIcon, roles: ['owner'] },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role, profile } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                            isActive
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                          )
                        }
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-xs font-bold text-accent-800 dark:bg-accent-500/15 dark:text-accent-300">
            {initials(profile?.full_name || 'Clinic User')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {profile?.full_name || 'Clinic user'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <p className="mt-3 truncate text-xs text-slate-400 dark:text-slate-500">
          {APP_CONFIG.clinicName}
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const { profile, role, signOut } = useAuth();
  const { theme, toggleTheme } = useThemeContext();
  const toast = useToast();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the drawer whenever the viewport grows to desktop width.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const handler = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not sign out'));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close navigation"
            >
              <CloseIcon />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
            >
              <MenuIcon />
            </button>
            <span className="lg:hidden">
              <Logo size="sm" />
            </span>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {APP_CONFIG.clinicName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Appointment &amp; inventory workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <RoleBadge role={role} />
              <span className="max-w-[12rem] truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {profile?.full_name || 'Clinic user'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Sign out"
            >
              <LogOutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <AlertIcon className="h-3.5 w-3.5" />
            Keep patient records confidential. Access is logged.
          </span>
        </footer>
      </div>
    </div>
  );
}
