-- ===========================================================================
-- ClinicFlow · 06 · pg_cron + pg_net schedules
-- ===========================================================================
-- Reminder email every day at 08:00 UTC, low-stock digest every Monday at
-- 07:00 UTC. Both call Supabase Edge Functions with the service role key.
--
-- Required Vault secrets (Dashboard → Project Settings → Vault):
--   project_url      e.g. https://abcdefghijkl.supabase.co   (no trailing /)
--   service_role_key the project's service_role secret
--
-- After adding the secrets, run once in the SQL editor:
--   select public.schedule_clinicflow_jobs();
--
-- Change the schedule strings below to match your clinic's timezone. The
-- database cron runs in UTC.
-- ===========================================================================

create or replace function public.schedule_clinicflow_jobs()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_url text;
  v_service_key text;
  v_reminders_cmd text;
  v_low_stock_cmd text;
begin
  -- Vault may not be enabled in every environment; read it defensively.
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''project_url'' limit 1'
      into v_project_url;
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''service_role_key'' limit 1'
      into v_service_key;
  exception when others then
    v_project_url := null;
    v_service_key := null;
  end;

  if v_project_url is null or v_service_key is null then
    raise notice
      'ClinicFlow: vault secrets project_url and service_role_key are required before scheduling cron jobs. See README.';
    return;
  end if;

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

  v_reminders_cmd := format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
    rtrim(v_project_url, '/') || '/functions/v1/send-reminders',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )::text,
    '{}'
  );

  v_low_stock_cmd := format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
    rtrim(v_project_url, '/') || '/functions/v1/send-low-stock-alert',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )::text,
    '{}'
  );

  perform cron.schedule('clinicflow-send-reminders', '0 8 * * *', v_reminders_cmd);
  perform cron.schedule('clinicflow-low-stock-alert', '0 7 * * 1', v_low_stock_cmd);

  raise notice 'ClinicFlow: reminder and low-stock cron jobs scheduled.';
end;
$$;

revoke all on function public.schedule_clinicflow_jobs() from public, anon, authenticated;

-- Attempts to schedule now. It is a no-op (with a notice) until the Vault
-- secrets exist, so migrations never fail on a fresh project.
select public.schedule_clinicflow_jobs();
