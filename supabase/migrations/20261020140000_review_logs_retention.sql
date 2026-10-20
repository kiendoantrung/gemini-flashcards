-- Retention tooling for review_logs, which grows by one row per rating and had
-- no way to be trimmed. At ~1.3k users the table gains roughly 130k rows/day,
-- so an unattended project accumulates tens of millions of rows within a year.
--
-- Tables touched: public.review_logs (index and function only).
-- Data impact: NONE. This migration creates an index and a function. It does
--   not delete a single row — pruning is opt-in and has to be scheduled
--   deliberately (see supabase/maintenance/).
-- Rollback: drop function public.prune_review_logs(integer, integer);
--   drop index public.review_logs_reviewed_at_idx;
--
-- The existing review_logs_undo_idx is partial on undone_at is null and keyed
-- by user/deck, so it cannot serve a global "oldest rows first" scan. Pruning
-- needs its own index or every batch would sort the whole table.

create index if not exists review_logs_reviewed_at_idx
  on public.review_logs (reviewed_at);

-- Deletes at most `batch_size` rows older than `keep_days` and returns how many
-- went. Batched on purpose: a single unbounded delete on a large table holds
-- locks, bloats WAL and can starve concurrent review writes. Call it in a loop
-- until it returns 0.
--
-- keep_days has a hard floor of 90. The statistics page reads a 30-day window,
-- and undo reads the newest row of a deck; keeping less than a quarter would
-- break both, so a typo like prune_review_logs(3) is rejected rather than
-- silently destroying history.
create or replace function public.prune_review_logs(
  keep_days integer default 365,
  batch_size integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  if keep_days is null or keep_days < 90 then
    raise exception 'prune_review_logs: keep_days must be >= 90, got %', keep_days
      using hint = 'The statistics page reads a 30-day window and undo reads the newest row; fewer than 90 days would break both.';
  end if;

  if batch_size is null or batch_size < 1 then
    raise exception 'prune_review_logs: batch_size must be >= 1, got %', batch_size;
  end if;

  with doomed as (
    select id
    from public.review_logs
    where reviewed_at < now() - make_interval(days => keep_days)
    order by reviewed_at
    limit batch_size
  )
  delete from public.review_logs as logs
  using doomed
  where logs.id = doomed.id;

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_review_logs(integer, integer) is
  'Deletes up to batch_size review_logs older than keep_days (min 90) and returns the count. Opt-in; nothing calls it automatically.';

-- Functions are executable by PUBLIC by default, and this one is SECURITY
-- DEFINER, so without this revoke any signed-in user could delete another
-- user's history. Only the service role may run it.
revoke all on function public.prune_review_logs(integer, integer) from public;
revoke all on function public.prune_review_logs(integer, integer) from anon;
revoke all on function public.prune_review_logs(integer, integer) from authenticated;
grant execute on function public.prune_review_logs(integer, integer) to service_role;
