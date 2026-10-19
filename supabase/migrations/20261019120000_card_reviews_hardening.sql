-- Harden the card_reviews table added in 20260829000000_card_reviews.sql.
--
-- Tables touched: public.card_reviews (new column, new trigger, orphan cleanup).
-- RLS impact: INSERT/UPDATE policies now also require the target deck to belong
--   to the caller. Previously a user could write a review row pointing at any
--   deck id; the row was theirs, but it still referenced someone else's deck.
-- Rollback: drop the trigger and column, delete the rows this migration removed
--   is NOT possible — run the cleanup only after taking a backup.

-- 1. updated_at so sync/debugging can tell when a row last changed.
alter table public.card_reviews
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_card_reviews_updated_at on public.card_reviews;
create trigger set_card_reviews_updated_at
  before update on public.card_reviews
  for each row execute function public.update_updated_at_column();

-- 2. Remove reviews whose card was deleted from the deck. Cards live in the
--    decks.cards JSONB column, so removing a card leaves its review row behind;
--    getDeckProgress() filters them at read time, this clears the backlog.
delete from public.card_reviews cr
where not exists (
  select 1
  from public.decks d
  where d.id = cr.deck_id
    and d.cards @> jsonb_build_array(jsonb_build_object('id', cr.card_id))
);

-- 3. Scope writes to decks the caller owns, not just to their own user_id.
drop policy if exists "Users can create their own card reviews" on public.card_reviews;
create policy "Users can create their own card reviews" on public.card_reviews
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own card reviews" on public.card_reviews;
create policy "Users can update their own card reviews" on public.card_reviews
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  );
