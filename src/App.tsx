import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, ProtectedLayout, RoleGate } from './components/guards';
import { isSupabaseConfigured } from './lib/supabase';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomeRedirect } from './pages/HomeRedirect';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignupPage } from './pages/SignupPage';
import { BookAppointmentPage } from './pages/customer/BookAppointmentPage';
import { MyAppointmentsPage } from './pages/customer/MyAppointmentsPage';
import { MyInvoicesPage } from './pages/customer/MyInvoicesPage';
import { AnalyticsPage } from './pages/owner/AnalyticsPage';
import { AuditLogsPage } from './pages/owner/AuditLogsPage';
import { ServicesPage } from './pages/owner/ServicesPage';
import { StaffPage } from './pages/owner/StaffPage';
import { AppointmentsPage } from './pages/staff/AppointmentsPage';
import { BillingPage } from './pages/staff/BillingPage';
import { DashboardPage } from './pages/staff/DashboardPage';
import { InventoryPage } from './pages/staff/InventoryPage';

function ConfigBanner() {
  return (
    <div className="bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
      Supabase is not configured. Copy <code className="font-mono">.env.example</code> to{' '}
      <code className="font-mono">.env</code> and set VITE_SUPABASE_URL and
      VITE_SUPABASE_ANON_KEY.
    </div>
  );
}

export default function App() {
  return (
    <>
      {isSupabaseConfigured ? null : <ConfigBanner />}
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Reachable with a recovery session, so not wrapped in GuestOnly. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/app" element={<ProtectedLayout />}>
          <Route index element={<HomeRedirect />} />

          <Route
            path="dashboard"
            element={
              <RoleGate roles={['staff', 'owner']}>
                <DashboardPage />
              </RoleGate>
            }
          />
          <Route
            path="book"
            element={
              <RoleGate roles={['customer']}>
                <BookAppointmentPage />
              </RoleGate>
            }
          />
          <Route
            path="my-appointments"
            element={
              <RoleGate roles={['customer']}>
                <MyAppointmentsPage />
              </RoleGate>
            }
          />
          <Route
            path="invoices"
            element={
              <RoleGate roles={['customer']}>
                <MyInvoicesPage />
              </RoleGate>
            }
          />
          <Route
            path="appointments"
            element={
              <RoleGate roles={['staff', 'owner']}>
                <AppointmentsPage />
              </RoleGate>
            }
          />
          <Route
            path="inventory"
            element={
              <RoleGate roles={['staff', 'owner']}>
                <InventoryPage />
              </RoleGate>
            }
          />
          <Route
            path="billing"
            element={
              <RoleGate roles={['staff', 'owner']}>
                <BillingPage />
              </RoleGate>
            }
          />

          <Route
            path="services"
            element={
              <RoleGate roles={['owner']}>
                <ServicesPage />
              </RoleGate>
            }
          />
          <Route
            path="staff"
            element={
              <RoleGate roles={['owner']}>
                <StaffPage />
              </RoleGate>
            }
          />
          <Route
            path="analytics"
            element={
              <RoleGate roles={['owner']}>
                <AnalyticsPage />
              </RoleGate>
            }
          />
          <Route
            path="audit-logs"
            element={
              <RoleGate roles={['owner']}>
                <AuditLogsPage />
              </RoleGate>
            }
          />

          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
