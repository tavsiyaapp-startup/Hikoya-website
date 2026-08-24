-- Storage buckets for story covers and user avatars.
-- Convention: object path is "{owner_user_id}/{filename}" in both buckets,
-- so RLS can check ownership from the path's first folder segment.

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "covers are publicly readable"
  on storage.objects for select using (bucket_id = 'covers');

create policy "users upload their own covers"
  on storage.objects for insert with check (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own covers"
  on storage.objects for update using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own covers"
  on storage.objects for delete using (
    bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars are publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "users upload their own avatar"
  on storage.objects for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own avatar"
  on storage.objects for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own avatar"
  on storage.objects for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
