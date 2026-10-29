-- Match API.md: the timer that calls B's /api/jobs is "labpass-server-jobs", every 5 minutes.
-- The URL still comes from Vault secret labpass_app_url (no-op until it exists).
select cron.unschedule('labpass-app-jobs') where exists (select 1 from cron.job where jobname = 'labpass-app-jobs');
select cron.schedule('labpass-server-jobs', '*/5 * * * *', 'select private.call_app_jobs()');
