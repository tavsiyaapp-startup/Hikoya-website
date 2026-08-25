-- Bucket for images embedded in a .docx manuscript during import
-- (src/lib/actions/import-docx.ts uploads each one here and rewrites its
-- <img src> to the resulting public URL). Same convention as covers/avatars:
-- object path is "{owner_id}/{filename}", RLS checks ownership via the
-- first path segment.

insert into storage.buckets (id, name, public) values ('chapter-images', 'chapter-images', true)
on conflict (id) do nothing;

create policy "chapter images are publicly readable" on storage.objects for select using (
  bucket_id = 'chapter-images'
);
create policy "users upload their own chapter images" on storage.objects for insert with check (
  bucket_id = 'chapter-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users delete their own chapter images" on storage.objects for delete using (
  bucket_id = 'chapter-images' and (storage.foldername(name))[1] = auth.uid()::text
);
