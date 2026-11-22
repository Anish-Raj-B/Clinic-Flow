-- ===========================================================================
-- ClinicFlow · 07 · Point scheduled jobs at the Python backend
-- ===========================================================================
-- ADDITIVE and SAFE: this migration only creates a new helper function. It
-- does not alter tables, data, policies, triggers or the existing
-- schedule_clinicflow_jobs() function.
--
-- The original deployment called Supabase Edge Functions from pg_cron. The
-- backend has been migrated to Python/FastAPI, so the schedules must now call:
--
--   POST {base_url}/api/jobs/send-reminders
--   POST {base_url}/api/jobs/send-low-stock-alert
--
-- Both endpoints expect `Authorization: Bearer <service_role_key>` exactly like
-- the old Edge Functions.
--
-- BEFORE RUNNING:
--   1. Make sure Vault contains the secret `service_role_key`
--      (Dashboard → Project Settings → Vault).
--   2. Deploy the Python backend and confirm /api/health responds.
--
-- THEN, once, in the SQL editor:
--   select public.schedule_clinicflow_backend_jobs('https://your-api.example.com');
--   select jobid, jobname, schedule, active from cron.job;
--
-- This migration intentionally does NOT schedule anything automatically: the
-- backend URL is environment-specific. Re-run the function whenever the URL or
-- schedule changes. Pass an empty string to unschedule both jobs.
-- ===========================================================================

create or replace function public.schedule_clinicflow_backend_jobs(p_base_url text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service_key text;
  v_reminders_cmd text;
  v_low_stock_cmd text;
  v_base text := rtrim(coalesce(p_base_url, ''), '/');
begin
  -- Always clear the two jobs first so this function is idempotent.
  begin
    perform cron.unschedule('clinicflow-send-reminders');
  exception when others then
    null;
  end;

  begin
    perform cron.unschedule('clinicflow-low-stock-alert');
  exception when others then
    null;
  end;

  if v_base = '' then
    raise notice 'ClinicFlow: backend jobs unscheduled (empty base URL).';
    return;
  end if;

  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''service_role_key'' limit 1'
      into v_service_key;
  exception when others then
    v_service_key := null;
  end;

  if v_service_key is null then
    raise notice
      'ClinicFlow: vault secret service_role_key is required before scheduling backend jobs.';
    return;
  end if;

  v_reminders_cmd := format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
    v_base || '/api/jobs/send-reminders',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )::text,
    '{}'
  );

  v_low_stock_cmd := format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
    v_base || '/api/jobs/send-low-stock-alert',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )::text,
    '{}'
  );

  perform cron.schedule('clinicflow-send-reminders', '0 8 * * *', v_reminders_cmd);
  perform cron.schedule('clinicflow-low-stock-alert', '0 7 * * 1', v_low_stock_cmd);

  raise notice 'ClinicFlow: reminder and low-stock jobs now call the Python backend.';
end;
$$;

revoke all on function public.schedule_clinicflow_backend_jobs(text) from public, anon, authenticated;

-- Optional cleanup of the legacy Edge Function schedules (safe if absent):
--   select cron.unschedule('clinicflow-send-reminders');
--   select cron.unschedule('clinicflow-low-stock-alert');
-- then re-run schedule_clinicflow_backend_jobs('https://your-api.example.com');
