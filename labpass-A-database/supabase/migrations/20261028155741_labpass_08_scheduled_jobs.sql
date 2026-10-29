-- Scheduled jobs with pg_cron (PRD open question: pg_cron chosen so all rules stay in the database).
--   labpass-jobs            every minute: overdue, no-shows (+ waitlist offers and no-show flags),
--                           offer expiry, closing stale requests, 1-hour reminders
--   labpass-weekly-credits  Monday 00:01 IST (Sunday 18:31 UTC): weekly sponsored top-up to 10 credits
-- cron.schedule() with an existing job name updates that job, so re-running is safe.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('labpass-jobs', '* * * * *', $$select public.run_scheduled_jobs()$$);
select cron.schedule('labpass-weekly-credits', '31 18 * * 0', $$select public.grant_weekly_credits()$$);
