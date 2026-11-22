export async function onRequest(context) {
  const env = context.env;

  const config = {
    SUPABASE_URL: env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || "",
    CLINIC_NAME: env.CLINIC_NAME || "ClinicFlow Clinic",
    CLINIC_ADDRESS: env.CLINIC_ADDRESS || "12 Health Street, Suite 4",
    CLINIC_PHONE: env.CLINIC_PHONE || "+1 (555) 010-2030",
    CLINIC_EMAIL: env.CLINIC_EMAIL || "billing@clinicflow.example",
    CLINIC_CURRENCY: env.CLINIC_CURRENCY || "USD",
    CLINIC_TIMEZONE: env.CLINIC_TIMEZONE || "UTC",
    API_BASE_URL: env.API_BASE_URL || ""
  };

  const payload = JSON.stringify(config).replace(/<\//g, "<\\/");

  return new Response(
    `window.__CLINICFLOW_CONFIG__ = ${payload};`,
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
