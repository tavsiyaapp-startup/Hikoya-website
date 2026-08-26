-- Homepage hero banner becomes a carousel. Slide 1 stays the hand-built,
-- translated hero JSX already in the app (title/body/CTAs from the ru/uz
-- dictionaries) — this table only holds the additional slides staff can add
-- from /admin/banner, shown after it in insertion order.

create table hero_slides (
  id uuid primary key default gen_random_uuid(),
  title_ru text not null,
  title_uz text not null,
  body_ru text not null,
  body_uz text not null,
  image_url text not null,
  cta_label_ru text,
  cta_label_uz text,
  cta_url text,
  created_at timestamptz not null default now()
);

alter table hero_slides enable row level security;
create policy "hero_slides are publicly readable" on hero_slides for select using (true);
create policy "staff manage hero_slides" on hero_slides for all using (is_staff()) with check (is_staff());

-- Storage: slide images are a site-wide asset staff uploads, not
-- user-owned content, so RLS gates on is_staff() rather than the
-- "{owner_id}/{filename}" path-ownership convention covers/avatars use.
insert into storage.buckets (id, name, public) values ('hero-slides', 'hero-slides', true)
on conflict (id) do nothing;

create policy "hero slide images are publicly readable" on storage.objects for select using (
  bucket_id = 'hero-slides'
);
create policy "staff upload hero slide images" on storage.objects for insert with check (
  bucket_id = 'hero-slides' and is_staff()
);
create policy "staff delete hero slide images" on storage.objects for delete using (
  bucket_id = 'hero-slides' and is_staff()
);
