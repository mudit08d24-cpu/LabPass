-- Calls the app's /api/jobs every minute (queued emails via Resend, expired photo purge).
-- Vercel Hobby cron can only run once a day, so Supabase pg_cron + pg_net triggers it instead.
--
-- The app URL and the shared secret live in Supabase Vault, never in this file:
--   select vault.create_secret('https://<your-app>.vercel.app', 'labpass_app_url');
--   select vault.create_secret('<same value as CRON_SECRET>', 'labpass_cron_secret');
-- Until both exist the job does nothing, so it is safe to run before the app is deployed.
create extension if not exists pg_net with schema extensions;

create or replace function private.call_app_jobs()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'labpass_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'labpass_cron_secret';
  if coalesce(v_url, '') !~ '^https?://' or coalesce(v_secret, '') = '' then
    return null;  -- not configured yet
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function private.call_app_jobs() from public, anon, authenticated;

select cron.schedule('labpass-app-jobs', '* * * * *', $$select private.call_app_jobs()$$);
