-- Small admin-managed announcement cards shown beside the home page's hero
-- banner (image and/or text, no CTA). Same shape/RLS/bucket pattern as
-- hero_slides (0023), just simpler: single image, no title/CTA fields.

create table announcements (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  text_ru text,
  text_uz text,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;
create policy "announcements are publicly readable" on announcements for select using (true);
create policy "staff manage announcements" on announcements for all using (is_staff()) with check (is_staff());

-- Storage: same reasoning as hero-slides — a site-wide asset staff
-- uploads, not user-owned content, so RLS gates on is_staff() rather than
-- the "{owner_id}/{filename}" path-ownership convention covers/avatars use.
insert into storage.buckets (id, name, public) values ('announcements', 'announcements', true)
on conflict (id) do nothing;

create policy "announcement images are publicly readable" on storage.objects for select using (
  bucket_id = 'announcements'
);
create policy "staff upload announcement images" on storage.objects for insert with check (
  bucket_id = 'announcements' and is_staff()
);
create policy "staff delete announcement images" on storage.objects for delete using (
  bucket_id = 'announcements' and is_staff()
);
