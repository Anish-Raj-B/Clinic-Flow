import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { APP_CONFIG, isSupabaseConfigured } from './config';

/**
 * Browser Supabase client. Uses the PUBLIC anon key only; Row Level Security is
 * what protects the data. A service_role key must never be used client-side.
 *
 * The fallback URL/key keep the app renderable when .env is missing so the UI
 * can show a configuration message instead of crashing on load.
 */
export const supabase = createClient<Database>(
  APP_CONFIG.supabaseUrl || 'http://127.0.0.1:54321',
  APP_CONFIG.supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      headers: { 'x-client-info': 'clinicflow-web' },
    },
  },
);

export { isSupabaseConfigured };
