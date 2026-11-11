-- Write a rating and its review_logs row in one transaction.
--
-- reviewCard used to upsert card_reviews and then insert review_logs as two
-- separate requests. When the second one failed, undo picked up the log of the
-- *previous* rating and rolled the card back two steps. Doing both writes in
-- one function makes that state impossible and saves a round trip per rating.
--
-- Tables touched: none structurally. New function public.review_card(...).
-- RLS impact: NONE. The function is SECURITY INVOKER, so the existing
--   card_reviews / review_logs policies (owner + deck ownership) apply to
--   every write exactly as they do for direct client writes. user_id is taken
--   from auth.uid(), never from an argument.
-- Data impact: NONE. No existing row is read differently or modified.
-- Deploy order: either. The client falls back to the two-request path when
--   this function does not exist yet (PostgREST error PGRST202).
-- Rollback: drop function public.review_card(uuid, text, smallint, text,
--   numeric, integer, integer, timestamptz, timestamptz, text, numeric,
--   integer, integer, timestamptz, timestamptz);

create or replace function public.review_card(
  p_deck_id uuid,
  p_card_id text,
  p_quality smallint,
  p_prev_status text,
  p_prev_ease_factor numeric,
  p_prev_interval integer,
  p_prev_repetitions integer,
  p_prev_due_date timestamptz,
  p_prev_last_reviewed_at timestamptz,
  p_next_status text,
  p_next_ease_factor numeric,
  p_next_interval integer,
  p_next_repetitions integer,
  p_next_due_date timestamptz,
  p_reviewed_at timestamptz
)
returns setof public.card_reviews
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_review public.card_reviews;
begin
  if v_user_id is null then
    raise exception 'review_card: not authenticated' using errcode = '42501';
  end if;

  insert into public.card_reviews as cr (
    user_id, deck_id, card_id, status, ease_factor, interval, repetitions,
    due_date, last_reviewed_at
  )
  values (
    v_user_id, p_deck_id, p_card_id, p_next_status, p_next_ease_factor,
    p_next_interval, p_next_repetitions, p_next_due_date, p_reviewed_at
  )
  on conflict (user_id, deck_id, card_id) do update set
    status = excluded.status,
    ease_factor = excluded.ease_factor,
    interval = excluded.interval,
    repetitions = excluded.repetitions,
    due_date = excluded.due_date,
    last_reviewed_at = excluded.last_reviewed_at
  returning cr.* into v_review;

  insert into public.review_logs (
    user_id, deck_id, card_id, quality,
    prev_status, prev_ease_factor, prev_interval, prev_repetitions,
    prev_due_date, prev_last_reviewed_at,
    next_status, next_ease_factor, next_interval, next_repetitions,
    next_due_date, reviewed_at
  )
  values (
    v_user_id, p_deck_id, p_card_id, p_quality,
    p_prev_status, p_prev_ease_factor, p_prev_interval, p_prev_repetitions,
    p_prev_due_date, p_prev_last_reviewed_at,
    p_next_status, p_next_ease_factor, p_next_interval, p_next_repetitions,
    p_next_due_date, p_reviewed_at
  );

  return next v_review;
  return;
end;
$$;

revoke all on function public.review_card(
  uuid, text, smallint, text, numeric, integer, integer, timestamptz, timestamptz,
  text, numeric, integer, integer, timestamptz, timestamptz
) from public, anon;

grant execute on function public.review_card(
  uuid, text, smallint, text, numeric, integer, integer, timestamptz, timestamptz,
  text, numeric, integer, integer, timestamptz, timestamptz
) to authenticated;
