-- B's /api/jobs route (API.md, "Scheduled jobs") checks the shared secret in an `x-cron-secret` header.
-- Send it in that header as well as `Authorization: Bearer`, so the timer works with either route.
-- Still reads the app URL and secret from Vault and does nothing until `labpass_app_url` is stored.
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret,
      'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function private.call_app_jobs() from public, anon, authenticated;
