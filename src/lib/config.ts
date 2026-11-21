/**
 * Runtime configuration read from Vite environment variables.
 * Only public values belong here - never a service_role key.
 */

type EnvRecord = Record<string, string | undefined>;

const env = import.meta.env as unknown as EnvRecord;

function readString(key: string, fallback: string): string {
  const value = env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export const APP_CONFIG = {
  clinicName: readString('VITE_CLINIC_NAME', 'ClinicFlow Clinic'),
  clinicAddress: readString('VITE_CLINIC_ADDRESS', '12 Health Street, Suite 4'),
  clinicPhone: readString('VITE_CLINIC_PHONE', '+1 (555) 010-2030'),
  clinicEmail: readString('VITE_CLINIC_EMAIL', 'billing@clinicflow.example'),
  currency: readString('VITE_CLINIC_CURRENCY', 'USD'),
  timeZone: readString('VITE_CLINIC_TIMEZONE', 'UTC'),
  supabaseUrl: readString('VITE_SUPABASE_URL', ''),
  supabaseAnonKey: readString('VITE_SUPABASE_ANON_KEY', ''),
} as const;

export const isSupabaseConfigured =
  APP_CONFIG.supabaseUrl.length > 0 && APP_CONFIG.supabaseAnonKey.length > 0;
