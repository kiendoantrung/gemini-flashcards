-- Two small fixes on public.decks.
--
-- 1. decks.updated_at had a default but no trigger, so it kept the creation
--    time forever. Attach the existing update_updated_at_column() trigger
--    (already used by card_reviews).
-- 2. decks_user_id_fkey had no ON DELETE action: deleting a user from Auth
--    failed with a foreign-key error (or needed manual cleanup), while
--    card_reviews, review_logs and deck_likes already cascade.
--
-- Tables touched: public.decks (one trigger, one foreign key re-created).
-- RLS impact: NONE.
-- Data impact: NONE at migration time. Existing updated_at values are left
--   as they are; from now on deleting an auth user also deletes their decks
--   (and, through the existing cascades, their reviews and logs).
-- Locking: the FK is added NOT VALID (brief lock, no table scan) and then
--   validated, which scans decks under a lock that does not block reads or
--   writes. The existing FK guarantees no orphans, so validation cannot fail.
-- Rollback:
--   drop trigger if exists set_decks_updated_at on public.decks;
--   alter table public.decks drop constraint decks_user_id_fkey;
--   alter table public.decks add constraint decks_user_id_fkey
--     foreign key (user_id) references auth.users(id);

drop trigger if exists set_decks_updated_at on public.decks;
create trigger set_decks_updated_at
  before update on public.decks
  for each row execute function public.update_updated_at_column();

alter table public.decks drop constraint if exists decks_user_id_fkey;
alter table public.decks
  add constraint decks_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;
alter table public.decks validate constraint decks_user_id_fkey;
