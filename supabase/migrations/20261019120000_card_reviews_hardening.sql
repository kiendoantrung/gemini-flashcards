-- Harden the card_reviews table added in 20260829000000_card_reviews.sql.
--
-- Tables touched: public.card_reviews (new column, new trigger, two policies).
-- RLS impact: INSERT/UPDATE policies now also require the target deck to belong
--   to the caller. Previously a user could write a review row pointing at any
--   deck id; the row was theirs, but it still referenced someone else's deck.
-- Rollback: drop the trigger and the column, restore the two previous policies.
--
-- This migration is intentionally non-destructive. Orphan reviews (rows whose
-- card was removed from decks.cards) are NOT deleted here: with live user data a
-- single bad assumption about the shape of decks.cards would wipe review
-- history, and the app already ignores those rows at read time. Cleanup is a
-- separate, opt-in script in supabase/maintenance/.

-- 1. updated_at so sync/debugging can tell when a row last changed.
--    `now()` is stable, so PostgreSQL 11+ adds the column without rewriting the
--    table; existing rows receive the statement timestamp.
alter table public.card_reviews
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_card_reviews_updated_at on public.card_reviews;
create trigger set_card_reviews_updated_at
  before update on public.card_reviews
  for each row execute function public.update_updated_at_column();

-- 2. Scope writes to decks the caller owns, not just to their own user_id.
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
