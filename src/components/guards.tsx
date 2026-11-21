import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../lib/utils';
import type { UserRole } from '../types/database';
import { AppShell } from './AppShell';
import { Button, FullPageLoader } from './ui';

function ProfileMissingScreen() {
  const { signOut } = useAuth();
  const toast = useToast();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="surface w-full max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Your profile is not ready yet
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          We could not load your ClinicFlow profile. Refresh the page, or sign out and sign in
          again. If this keeps happening, ask your clinic owner to check your account.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={() => window.location.reload()}>Refresh page</Button>
          <Button
            variant="outline"
            onClick={() => {
              void signOut().catch((error: unknown) =>
                toast.error(getErrorMessage(error, 'Could not sign out')),
              );
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Requires an authenticated user with a profile; renders the app shell. */
export function ProtectedLayout() {
  const { session, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!profile) return <ProfileMissingScreen />;

  return <AppShell />;
}

/** Redirects signed-in users away from the login/signup screens. */
export function GuestOnly() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (loading) return <FullPageLoader />;
  if (session) return <Navigate to={from ?? '/app'} replace />;
  return <Outlet />;
}

/** Route-level role enforcement (defence in depth on top of RLS). */
export function RoleGate({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { role } = useAuth();
  if (!roles.includes(role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
