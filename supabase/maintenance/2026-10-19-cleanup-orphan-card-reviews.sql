-- OPT-IN MAINTENANCE — not a migration.
-- `supabase db push` will NOT run this file; you execute it by hand.
--
-- Why it is separate: it deletes rows from public.card_reviews, which holds real
-- user history. The application already ignores these rows at read time
-- (getDueCards and getDeckProgress both filter against decks.cards), so leaving
-- them in place costs storage only. Deleting them is a choice, not a fix.
--
-- Back up first, always:
--   supabase db dump --data-only -t public.card_reviews -f card_reviews_backup.sql
--
-- Then run step 1, read the numbers, and only run step 2 if they make sense.

-- ---------------------------------------------------------------------------
-- Step 1 — inspect. Nothing is modified here.
-- ---------------------------------------------------------------------------

-- How many rows in total, and how many look orphaned?
select
  count(*) as total_rows,
  count(*) filter (
    where exists (
      select 1
      from public.decks d
      where d.id = cr.deck_id
        and jsonb_typeof(d.cards) = 'array'
        and not (d.cards @> jsonb_build_array(jsonb_build_object('id', cr.card_id)))
    )
  ) as orphan_rows
from public.card_reviews cr;

-- Sanity check on the data shape this script relies on. If any of these are
-- non-zero, stop and look at the decks before deleting anything: the predicate
-- would not be able to tell a missing card from an unexpected `cards` shape.
select
  count(*) filter (where jsonb_typeof(d.cards) is distinct from 'array') as decks_with_non_array_cards,
  count(*) filter (where jsonb_typeof(d.cards) = 'array' and jsonb_array_length(d.cards) = 0) as decks_with_no_cards
from public.decks d;

-- Which decks would lose the most history? Skim the top 20 before deleting.
select
  cr.deck_id,
  d.title,
  count(*) as orphan_rows
from public.card_reviews cr
join public.decks d on d.id = cr.deck_id
where jsonb_typeof(d.cards) = 'array'
  and not (d.cards @> jsonb_build_array(jsonb_build_object('id', cr.card_id)))
group by cr.deck_id, d.title
order by orphan_rows desc
limit 20;

-- ---------------------------------------------------------------------------
-- Step 2 — delete. Runs inside a transaction: COMMIT to keep, ROLLBACK to undo.
-- Only rows for decks whose `cards` is a well-formed array are touched.
-- ---------------------------------------------------------------------------

begin;

delete from public.card_reviews cr
where exists (
  select 1
  from public.decks d
  where d.id = cr.deck_id
    and jsonb_typeof(d.cards) = 'array'
    and not (d.cards @> jsonb_build_array(jsonb_build_object('id', cr.card_id)))
);

-- Expect "DELETE <n>" where n matches orphan_rows from step 1.
-- Re-run the step 1 count here if you want to confirm it is now 0.

-- commit;
-- rollback;
