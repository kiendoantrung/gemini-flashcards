-- OPT-IN MAINTENANCE — not a migration.
-- `supabase db push` will NOT run this file; you execute it by hand.
--
-- Why it is separate: it schedules DELETION of review_logs rows. The log is real
-- user history — it backs undo and the statistics page. Trimming it is a storage
-- decision, not a correctness fix, so it must be a deliberate act.
--
-- The function itself lives in
-- supabase/migrations/20261020140000_review_logs_retention.sql and does nothing
-- until something calls it. This file is that "something", and it is optional.
--
-- What is safe to delete: the statistics page reads a 30-day window and undo
-- reads only the newest non-undone row of a deck, so rows older than a year have
-- no reader. 365 days is the default and the floor is 90.
--
-- ---------------------------------------------------------------------------
-- Step 1 — inspect. Nothing is modified here.
-- ---------------------------------------------------------------------------

-- Total rows, oldest row, and how many a 365-day prune would eventually remove.
select
  count(*) as total_rows,
  min(reviewed_at) as oldest_review,
  max(reviewed_at) as newest_review,
  count(*) filter (where reviewed_at < now() - interval '365 days') as older_than_365d,
  pg_size_pretty(pg_total_relation_size('public.review_logs')) as table_size
from public.review_logs;

-- Rough daily ingest, to project how fast the table will grow.
select
  date_trunc('day', reviewed_at) as day,
  count(*) as rows
from public.review_logs
where reviewed_at > now() - interval '14 days'
group by 1
order by 1 desc;

-- ---------------------------------------------------------------------------
-- Step 2 — dry run. Reports the count a single batch would delete, then rolls
-- back. Replace 365 with the retention you actually want.
-- ---------------------------------------------------------------------------

begin;

select count(*) as would_delete_from_oldest_batch
from (
  select id
  from public.review_logs
  where reviewed_at < now() - interval '365 days'
  order by reviewed_at
  limit 5000
) as doomed;

rollback;

-- ---------------------------------------------------------------------------
-- Step 3 — prune by hand. Call the function repeatedly until it returns 0.
-- Safe to interrupt: each call is its own transaction and deletes at most
-- batch_size rows, so it never holds a long lock.
-- ---------------------------------------------------------------------------

-- select public.prune_review_logs(365, 5000);

-- ---------------------------------------------------------------------------
-- Step 4 — schedule it (optional). Requires the pg_cron extension, which has to
-- be enabled per project first (Dashboard → Database → Extensions → pg_cron).
-- Run this once, as the postgres role, after step 3 confirms the numbers.
-- ---------------------------------------------------------------------------

-- create extension if not exists pg_cron;

-- Nightly at 03:15 UTC. One batch per night is plenty for a 1.3k-user project;
-- raise the batch size or add a second run if the backlog grows.
-- select cron.schedule(
--   'prune-review-logs',
--   '15 3 * * *',
--   $$select public.prune_review_logs(365, 5000)$$
-- );

-- Check it is registered, and inspect the last runs:
-- select * from cron.job where jobname = 'prune-review-logs';
-- select * from cron.job_run_details order by start_time desc limit 20;

-- To stop it:
-- select cron.unschedule('prune-review-logs');
