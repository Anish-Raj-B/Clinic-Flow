/**
 * Browser Supabase client. Uses the PUBLIC anon key only; Row Level Security
 * protects the data. A service_role key must never reach this file.
 *
 * The vendored UMD build exposes `window.supabase.createClient`.
 */

import { APP_CONFIG } from "./config.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;

function createClient(url, key, options) {
  const factory = globalScope.supabase;
  if (!factory || typeof factory.createClient !== "function") {
    throw new Error(
      "The Supabase client library failed to load. Check /js/vendor/supabase.js.",
    );
  }
  return factory.createClient(url, key, options);
}

/**
 * Fallback URL/key keep the app renderable when configuration is missing, so
 * the UI can show the amber configuration banner instead of crashing on load.
 */
export const supabase = createClient(
  APP_CONFIG.supabaseUrl || "http://127.0.0.1:54321",
  APP_CONFIG.supabaseAnonKey || "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    global: {
      headers: { "x-client-info": "clinicflow-web" },
    },
  },
);

export { isSupabaseConfigured } from "./config.js";
