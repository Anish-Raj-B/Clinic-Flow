/**
 * Runtime configuration.
 *
 * The original app read Vite `VITE_*` variables inlined at build time. The
 * Python backend now serves the same public values at /api/config.js as
 * `window.__CLINICFLOW_CONFIG__`, so no build step or bundler is needed and no
 * secret is ever inlined. Only public values live here (anon key, branding).
 */

const runtime =
  (typeof window !== "undefined" && window.__CLINICFLOW_CONFIG__) || {};

function readString(key, fallback) {
  const value = runtime[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export const APP_CONFIG = {
  clinicName: readString("CLINIC_NAME", "ClinicFlow Clinic"),
  clinicAddress: readString("CLINIC_ADDRESS", "12 Health Street, Suite 4"),
  clinicPhone: readString("CLINIC_PHONE", "+1 (555) 010-2030"),
  clinicEmail: readString("CLINIC_EMAIL", "billing@clinicflow.example"),
  currency: readString("CLINIC_CURRENCY", "USD"),
  timeZone: readString("CLINIC_TIMEZONE", "UTC"),
  supabaseUrl: readString("SUPABASE_URL", ""),
  supabaseAnonKey: readString("SUPABASE_ANON_KEY", ""),
};

export const isSupabaseConfigured =
  APP_CONFIG.supabaseUrl.length > 0 && APP_CONFIG.supabaseAnonKey.length > 0;

/** Base URL of the Python backend (same origin by default). */
export const API_BASE = readString("API_BASE_URL", "").replace(/\/$/, "");
