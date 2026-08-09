drop policy if exists "Users can manage their own decks"
on public.decks;

drop policy if exists "Users can update their own decks"
on public.decks;

create policy "Users can view their own decks"
on public.decks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own decks"
on public.decks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own decks"
on public.decks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own decks"
on public.decks
for delete
to authenticated
using ((select auth.uid()) = user_id);