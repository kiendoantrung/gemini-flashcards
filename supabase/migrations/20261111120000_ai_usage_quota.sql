-- Per-user daily quota for the generate-flashcards Edge Function.
--
-- Before this, any signed-in account could call the function in a loop and
-- exhaust the Gemini quota of every configured key for all ~1.5k users.
--
-- Tables touched: new table public.ai_usage_daily, new function
--   public.consume_ai_quota(uuid, integer). No existing table is modified.
-- RLS impact: the new table has RLS enabled and NO policies, and anon /
--   authenticated have no grants on it. Only the Edge Function, using the
--   service role, reads or writes it.
-- Data impact: NONE for existing data. One row per user per active UTC day
--   (~1.5k rows/day at most); safe to prune rows older than a week at will.
-- Deploy order: either. The function fails open when consume_ai_quota is
--   missing, so deploying the function before this migration only means the
--   quota is not enforced yet.
-- Rollback: drop function public.consume_ai_quota(uuid, integer);
--   drop table public.ai_usage_daily;

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;
revoke all on table public.ai_usage_daily from anon, authenticated;

-- Counts one request for `p_user_id` today (UTC) and returns the new total,
-- or NULL when the user had already reached `p_daily_limit`.
--
-- Atomic under concurrency: the conditional upsert takes the row lock, so two
-- parallel requests at limit - 1 cannot both get through.
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_daily_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used integer;
begin
  if p_user_id is null or p_daily_limit is null or p_daily_limit < 1 then
    raise exception 'consume_ai_quota: invalid arguments';
  end if;

  insert into public.ai_usage_daily as usage (user_id, usage_date, request_count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = usage.request_count + 1
    where usage.request_count < p_daily_limit
  returning usage.request_count into used;

  -- No row returned: the WHERE above rejected the update, i.e. limit reached.
  return used;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
