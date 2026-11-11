-- Harden the avatars bucket.
--
-- Before: any authenticated user could upload any file type to any path in
-- the public avatars bucket (the insert policy only checked the role), SVGs
-- included, which can carry script when the public URL is opened directly.
--
-- Tables touched: storage.buckets (avatars row: MIME/size limits),
--   storage.objects (the INSERT policy for the avatars bucket is replaced).
-- RLS impact: uploads must now go to `<auth.uid()>/...`. The new client
--   writes there. Select (public), update and delete (owner) policies are
--   unchanged, so every existing avatar stays readable and deletable by its
--   owner.
-- Data impact: NONE. No object is moved or deleted. Existing avatars at the
--   bucket root keep working; they are cleaned up by the client the next
--   time their owner changes avatar.
-- Deploy order: ship the client first (it already uploads to <uid>/...), or
--   apply both together. With this migration but the OLD client, avatar
--   uploads fail with an RLS error until the client is deployed.
-- Rollback:
--   update storage.buckets set allowed_mime_types = null, file_size_limit = null
--     where id = 'avatars';
--   drop policy if exists "Users can upload their own avatar files" on storage.objects;
--   create policy "Users can upload avatar files." on storage.objects
--     for insert to public
--     with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- The bucket exists in production but was created by hand; create it here if
-- missing so a fresh environment works, without touching `public` on an
-- existing bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload avatar files." on storage.objects;
drop policy if exists "Users can upload their own avatar files" on storage.objects;
create policy "Users can upload their own avatar files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
