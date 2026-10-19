-- Append-only log of every rating, used for undo (and later for retention
-- stats and scheduling diagnostics). card_reviews holds only the current state.
--
-- Tables touched: new table public.review_logs.
-- RLS impact: new table, policies scoped to auth.uid() = user_id; no DELETE
--   policy because rows are never removed — undo sets undone_at instead.
-- Rollback: drop table public.review_logs. No other table is modified, so the
--   existing review state is untouched either way.

create table if not exists public.review_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_id text not null,
  quality smallint not null check (quality between 1 and 4),
  -- State before the rating. prev_status = 'new' means the card had no row yet.
  prev_status text not null,
  prev_ease_factor numeric not null,
  prev_interval integer not null,
  prev_repetitions integer not null,
  prev_due_date timestamptz,
  prev_last_reviewed_at timestamptz,
  -- State after the rating, so the log is self-contained.
  next_status text not null,
  next_ease_factor numeric not null,
  next_interval integer not null,
  next_repetitions integer not null,
  next_due_date timestamptz not null,
  reviewed_at timestamptz not null default now(),
  undone_at timestamptz
);

-- Undo only ever asks for the newest non-undone row of one deck.
create index if not exists review_logs_undo_idx
  on public.review_logs (user_id, deck_id, reviewed_at desc)
  where undone_at is null;

alter table public.review_logs enable row level security;

create policy "Users can view their own review logs" on public.review_logs
  for select to authenticated using (auth.uid() = user_id);

create policy "Users can create their own review logs" on public.review_logs
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = auth.uid()
    )
  );

-- Rows are scoped to their owner. This policy does not restrict which columns
-- may be written: setting undone_at is the only mutation the client performs,
-- but a user rewriting their own history is not a security boundary worth a
-- trigger over. The table is append-mostly by convention.
create policy "Users can mark their own review logs undone" on public.review_logs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.review_logs to authenticated;
