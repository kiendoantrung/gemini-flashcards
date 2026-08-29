create table public.card_reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_id text not null,
  status text not null default 'new'
    check (status in ('new', 'learning', 'review', 'relearning')),
  ease_factor numeric not null default 2.5 check (ease_factor >= 1.3),
  interval integer not null default 0 check (interval >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  due_date timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, deck_id, card_id)
);

create index card_reviews_user_deck_due_date_idx
  on public.card_reviews (user_id, deck_id, due_date);

alter table public.card_reviews enable row level security;

create policy "Users can view their own card reviews" on public.card_reviews
  for select to authenticated using (auth.uid() = user_id);

create policy "Users can create their own card reviews" on public.card_reviews
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own card reviews" on public.card_reviews
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own card reviews" on public.card_reviews
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.card_reviews to authenticated;
