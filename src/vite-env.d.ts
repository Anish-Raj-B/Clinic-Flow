/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CLINIC_NAME?: string;
  readonly VITE_CLINIC_ADDRESS?: string;
  readonly VITE_CLINIC_PHONE?: string;
  readonly VITE_CLINIC_EMAIL?: string;
  readonly VITE_CLINIC_CURRENCY?: string;
  readonly VITE_CLINIC_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
