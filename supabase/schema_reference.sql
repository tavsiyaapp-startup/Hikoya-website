-- =============================================================================
-- HIKOYA — СПРАВОЧНАЯ СХЕМА БАЗЫ ДАННЫХ (backup / reference)
-- =============================================================================
-- Это НЕ миграция и никуда автоматически не применяется (Supabase CLI её не
-- видит, т.к. она лежит не в supabase/migrations/). Файл — личный бэкап и
-- "источник правды" о том, какой должна быть структура базы целиком, в одном
-- месте, с комментариями.
--
-- Реальные изменения в базу вносятся через новые файлы в supabase/migrations/
-- (supabase db push). А сюда, в этот файл, тот же самый SQL нужно ПРОДУБЛИРОВАТЬ
-- (или обновить существующий кусок), плюс дописать запись в раздел
-- "ИСТОРИЯ ИЗМЕНЕНИЙ" внизу файла — что изменилось и зачем.
--
-- Соответствует миграциям 0001–0007 (supabase/migrations/), состояние на
-- 2026-08-24. Также должно совпадать с src/types/database.ts — при любом
-- изменении схемы обновляй и типы тоже.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ── enum-типы ────────────────────────────────────────────────────────────────

create type user_role as enum ('reader', 'author', 'moderator', 'admin');
create type user_status as enum ('active', 'blocked');
create type story_status as enum ('draft', 'published', 'unlisted');
create type story_visibility as enum ('public', 'unlisted', 'draft');
create type age_rating as enum ('0+', '12+', '16+', '18+');
create type content_language as enum ('ru', 'uz');
create type chapter_status as enum ('draft', 'published');
create type tag_category as enum ('genre', 'relationship', 'warning', 'style', 'age_rating');
create type collection_owner_type as enum ('user', 'author', 'moderator');
create type request_status as enum ('open', 'in_progress', 'fulfilled');
create type request_response_status as enum ('proposed', 'accepted', 'declined');
create type report_target_type as enum ('story', 'chapter', 'comment');
create type report_status as enum ('open', 'reviewed', 'resolved');
create type like_target_type as enum ('story', 'chapter', 'comment');

-- ── profiles ───────────────────────────────────────────────────────────────
-- 1:1 с auth.users. Создаётся автоматически триггером handle_new_user()
-- при регистрации (Google/Email/Telegram) — см. ниже.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  role user_role not null default 'reader',
  status user_status not null default 'active',
  locale_pref content_language not null default 'ru',
  interests text[] not null default '{}',
  telegram_id bigint unique,        -- добавлено в 0006: для входа через Telegram
  onboarded_at timestamptz,         -- добавлено в 0006: отметка "прошёл онбординг"
  created_at timestamptz not null default now()
);

-- ── stories & chapters ─────────────────────────────────────────────────────

create table stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text not null default '',
  cover_url text,
  genre text not null,
  language content_language not null default 'ru',
  age_rating age_rating not null default '0+',
  relationship_type text,
  style text,
  status story_status not null default 'draft',
  visibility story_visibility not null default 'draft',
  announce text,
  view_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  bookmark_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index stories_author_id_idx on stories (author_id);
create index stories_status_idx on stories (status) where status = 'published';
create index stories_genre_idx on stories (genre);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories (id) on delete cascade,
  order_index integer not null,
  title text not null,
  content text not null default '',
  word_count integer not null default 0,
  status chapter_status not null default 'draft',
  is_free boolean not null default false,   -- глава бесплатна вне зависимости от лимита гостя
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),   -- добавлено в 0008: дата последнего редактирования главы
  published_at timestamptz,
  unique (story_id, order_index)
);

create index chapters_story_id_idx on chapters (story_id);

-- ── социальный граф ────────────────────────────────────────────────────────

create table comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  parent_id uuid references comments (id) on delete cascade,
  text text not null,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index comments_chapter_id_idx on comments (chapter_id);

create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  target_type like_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  story_id uuid not null references stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, story_id)
);

create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, author_id),
  check (follower_id <> author_id)
);

create table reading_progress (
  user_id uuid not null references profiles (id) on delete cascade,
  story_id uuid not null references stories (id) on delete cascade,
  chapter_id uuid not null references chapters (id) on delete cascade,
  percent numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

-- ── теги ───────────────────────────────────────────────────────────────────

create table tags (
  id uuid primary key default gen_random_uuid(),
  category tag_category not null,
  label_ru text not null,
  label_uz text not null,
  unique (category, label_ru)
);

create table story_tags (
  story_id uuid not null references stories (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (story_id, tag_id)
);

-- ── коллекции (подборки) ──────────────────────────────────────────────────

create table collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  owner_type collection_owner_type not null default 'user',
  title text not null,
  description text,
  is_featured boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create index collections_owner_id_idx on collections (owner_id);

create table collection_items (
  collection_id uuid not null references collections (id) on delete cascade,
  story_id uuid not null references stories (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, story_id)
);

-- ── достижения авторов ──────────────────────────────────────────────────────

create table achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title_ru text not null,
  title_uz text not null,
  description_ru text not null,
  description_uz text not null,
  metric text not null check (metric in ('story_count', 'follower_count', 'total_likes', 'publish_streak_weeks')),
  threshold integer not null
);

create table user_achievements (
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_id uuid not null references achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ── доска заявок (requests board) ───────────────────────────────────────────

create table requests (
  id uuid primary key default gen_random_uuid(),
  target_author_id uuid references profiles (id) on delete cascade,
  from_user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  text text not null,
  tags text[] not null default '{}',
  status request_status not null default 'open',
  story_id uuid references stories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index requests_target_author_id_idx on requests (target_author_id);

create table request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  text text not null,
  status request_response_status not null default 'proposed',
  story_id uuid references stories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index request_responses_request_id_idx on request_responses (request_id);

-- ── жалобы (модерация) ──────────────────────────────────────────────────────

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ── настройки платформы (одна строка на весь проект) ────────────────────────

create table platform_settings (
  id integer primary key default 1,
  guest_free_chapters integer not null default 1,   -- сколько первых глав видно гостям (1-4)
  enabled_locales content_language[] not null default '{ru,uz}',
  comments_require_approval boolean not null default false,
  new_story_requires_review boolean not null default false,
  check (id = 1)
);

insert into platform_settings (id) values (1);

-- =============================================================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- =============================================================================

-- Денормализованные счётчики на stories (like/bookmark/comment_count)
-- обновляются автоматически при insert/delete в соответствующих таблицах.
-- ВАЖНО: new.target_type проверяется ТОЛЬКО внутри ветки tg_table_name =
-- 'likes' (вложенный if, не единое and-условие) — см. changelog 0009: если
-- вынести new.target_type в общее условие верхнего уровня, Postgres пытается
-- резолвить это поле у NEW и для bookmarks/comments, где такой колонки нет,
-- и роняет insert с "record \"new\" has no field \"target_type\"".
create or replace function bump_story_counters() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'likes' then
      if new.target_type = 'story' then
        update stories set like_count = like_count + 1 where id = new.target_id;
      end if;
    elsif tg_table_name = 'bookmarks' then
      update stories set bookmark_count = bookmark_count + 1 where id = new.story_id;
    elsif tg_table_name = 'comments' then
      update stories set comment_count = comment_count + 1
        where id = (select story_id from chapters where id = new.chapter_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if tg_table_name = 'likes' then
      if old.target_type = 'story' then
        update stories set like_count = greatest(like_count - 1, 0) where id = old.target_id;
      end if;
    elsif tg_table_name = 'bookmarks' then
      update stories set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.story_id;
    elsif tg_table_name = 'comments' then
      update stories set comment_count = greatest(comment_count - 1, 0)
        where id = (select story_id from chapters where id = old.chapter_id);
    end if;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger likes_bump_story_counters
  after insert or delete on likes
  for each row execute function bump_story_counters();

create trigger bookmarks_bump_story_counters
  after insert or delete on bookmarks
  for each row execute function bump_story_counters();

create trigger comments_bump_story_counters
  after insert or delete on comments
  for each row execute function bump_story_counters();

-- Автосоздание профиля при регистрации (Google/Email/Telegram).
-- Онбординг (3 шага) потом дозаполняет role/interests/locale_pref через UPDATE.
create or replace function handle_new_user() returns trigger as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''),
    'user'
  );
  candidate := base_username;

  while exists (select 1 from profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'full_name', candidate));

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Атомарный инкремент просмотров главы + истории.
-- Вызывается со страницы читалки через service-role клиент (у view_count
-- нет публичной RLS-политики на запись специально).
create or replace function increment_view_counts(p_chapter_id uuid, p_story_id uuid) returns void as $$
begin
  update chapters set view_count = view_count + 1 where id = p_chapter_id;
  update stories set view_count = view_count + 1 where id = p_story_id;
end;
$$ language plpgsql security definer;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Важно: гостевой лимит бесплатных глав (platform_settings.guest_free_chapters)
-- здесь НЕ проверяется — RLS разрешает читать все опубликованные главы всем,
-- а решение "показать текст целиком или заглушку" принимается на сервере в
-- src/app/(site)/story/[slug]/[chapter]/page.tsx.

create or replace function is_staff() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  );
$$ language sql security definer stable;

-- profiles
alter table profiles enable row level security;
create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users insert their own profile" on profiles for insert with check (id = auth.uid());
create policy "users update their own profile" on profiles for update using (id = auth.uid() or is_staff());

-- stories
alter table stories enable row level security;
create policy "published public stories are readable" on stories for select using (
  (status = 'published' and visibility in ('public', 'unlisted'))
  or author_id = auth.uid()
  or is_staff()
);
create policy "authors insert their own stories" on stories for insert with check (author_id = auth.uid());
create policy "authors update their own stories" on stories for update using (author_id = auth.uid() or is_staff());
create policy "authors delete their own stories" on stories for delete using (author_id = auth.uid() or is_staff());

-- chapters
alter table chapters enable row level security;
create policy "published chapters of readable stories are readable" on chapters for select using (
  (
    status = 'published'
    and exists (
      select 1 from stories
      where stories.id = chapters.story_id
        and stories.status = 'published'
        and stories.visibility in ('public', 'unlisted')
    )
  )
  or exists (select 1 from stories where stories.id = chapters.story_id and stories.author_id = auth.uid())
  or is_staff()
);
create policy "story owners insert chapters" on chapters for insert with check (
  exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
);
create policy "story owners update chapters" on chapters for update using (
  exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
  or is_staff()
);
create policy "story owners delete chapters" on chapters for delete using (
  exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
  or is_staff()
);

-- comments
alter table comments enable row level security;
create policy "comments on readable chapters are readable" on comments for select using (
  exists (
    select 1 from chapters
    where chapters.id = comments.chapter_id and chapters.status = 'published'
  )
  or is_staff()
);
create policy "authenticated users insert their own comments" on comments for insert with check (user_id = auth.uid());
create policy "users update their own comments" on comments for update using (user_id = auth.uid() or is_staff());
create policy "users delete their own comments" on comments for delete using (user_id = auth.uid() or is_staff());

-- likes / bookmarks / reading_progress — приватны владельцу
alter table likes enable row level security;
create policy "users manage their own likes" on likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table bookmarks enable row level security;
create policy "users manage their own bookmarks" on bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table reading_progress enable row level security;
create policy "users manage their own reading progress" on reading_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- follows — публично читаемо (списки подписчиков/подписок)
alter table follows enable row level security;
create policy "follows are publicly readable" on follows for select using (true);
create policy "users manage their own follows" on follows for insert with check (follower_id = auth.uid());
create policy "users remove their own follows" on follows for delete using (follower_id = auth.uid());

-- tags / story_tags
alter table tags enable row level security;
create policy "tags are publicly readable" on tags for select using (true);
create policy "staff manage tags" on tags for all using (is_staff()) with check (is_staff());

alter table story_tags enable row level security;
create policy "story_tags are publicly readable" on story_tags for select using (true);
create policy "story owners manage their story_tags" on story_tags for all using (
  exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
  or is_staff()
) with check (
  exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
  or is_staff()
);

-- collections
alter table collections enable row level security;
create policy "public collections are readable" on collections for select using (
  not is_private or owner_id = auth.uid() or is_staff()
);
create policy "users insert their own collections" on collections for insert with check (owner_id = auth.uid());
create policy "owners update their own collections" on collections for update using (owner_id = auth.uid() or is_staff());
create policy "owners delete their own collections" on collections for delete using (owner_id = auth.uid() or is_staff());

alter table collection_items enable row level security;
create policy "collection_items follow parent collection visibility" on collection_items for select using (
  exists (
    select 1 from collections
    where collections.id = collection_id
      and (not collections.is_private or collections.owner_id = auth.uid() or is_staff())
  )
);
create policy "collection owners manage items" on collection_items for all using (
  exists (select 1 from collections where collections.id = collection_id and collections.owner_id = auth.uid())
  or is_staff()
) with check (
  exists (select 1 from collections where collections.id = collection_id and collections.owner_id = auth.uid())
  or is_staff()
);

-- achievements
alter table achievements enable row level security;
create policy "achievements are publicly readable" on achievements for select using (true);
create policy "staff manage achievements" on achievements for all using (is_staff()) with check (is_staff());

alter table user_achievements enable row level security;
create policy "user_achievements are publicly readable" on user_achievements for select using (true);
create policy "staff award achievements" on user_achievements for all using (is_staff()) with check (is_staff());

-- requests board
alter table requests enable row level security;
create policy "requests are publicly readable" on requests for select using (true);
create policy "users insert their own requests" on requests for insert with check (from_user_id = auth.uid());
create policy "requesters and staff update requests" on requests for update using (from_user_id = auth.uid() or is_staff());
create policy "requesters and staff delete requests" on requests for delete using (from_user_id = auth.uid() or is_staff());

alter table request_responses enable row level security;
create policy "request_responses are publicly readable" on request_responses for select using (true);
create policy "authors insert their own responses" on request_responses for insert with check (author_id = auth.uid());
create policy "authors and staff update responses" on request_responses for update using (author_id = auth.uid() or is_staff());
create policy "authors and staff delete responses" on request_responses for delete using (author_id = auth.uid() or is_staff());

-- reports
alter table reports enable row level security;
create policy "reporters and staff read reports" on reports for select using (reporter_id = auth.uid() or is_staff());
create policy "authenticated users file reports" on reports for insert with check (reporter_id = auth.uid());
create policy "staff manage reports" on reports for update using (is_staff());
create policy "staff delete reports" on reports for delete using (is_staff());

-- platform_settings
alter table platform_settings enable row level security;
create policy "platform settings are publicly readable" on platform_settings for select using (true);
create policy "staff update platform settings" on platform_settings for update using (is_staff());

-- =============================================================================
-- STORAGE (файловое хранилище)
-- =============================================================================
-- Соглашение: путь объекта — "{id_владельца}/{имя_файла}" в обоих бакетах,
-- чтобы RLS могла проверять владение по первому сегменту пути.

insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

create policy "covers are publicly readable" on storage.objects for select using (bucket_id = 'covers');
create policy "users upload their own covers" on storage.objects for insert with check (
  bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users update their own covers" on storage.objects for update using (
  bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users delete their own covers" on storage.objects for delete using (
  bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars are publicly readable" on storage.objects for select using (bucket_id = 'avatars');
create policy "users upload their own avatar" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users update their own avatar" on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users delete their own avatar" on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ (seed)
-- =============================================================================
-- age_rating — отдельная колонка на stories (0+/12+/16+/18+), поэтому тегов
-- категории 'age_rating' здесь нет — только мультивыборные категории
-- (genre/relationship/warning/style). Админ может добавлять/редактировать
-- строки в tags и achievements позже через /admin.

insert into tags (category, label_ru, label_uz) values
  ('genre', 'Романтика', 'Romantika'),
  ('genre', 'Фэнтези', 'Fentezi'),
  ('genre', 'Детектив', 'Detektiv'),
  ('genre', 'Драма', 'Drama'),
  ('genre', 'Научная фантастика', 'Ilmiy fantastika'),
  ('genre', 'Ужасы', 'Qoʻrqinchli'),
  ('genre', 'Исторические', 'Tarixiy'),
  ('genre', 'Мифология', 'Mifologiya'),
  ('genre', 'Подростковые', 'Oʻsmirlar uchun'),
  ('genre', 'Другое', 'Boshqa'),
  ('relationship', 'Разнополые отношения', 'Turli jinsdagilar munosabati'),
  ('relationship', 'Однополые отношения', 'Bir jinsdagilar munosabati'),
  ('relationship', 'Множественные пары', 'Bir nechta juftlik'),
  ('relationship', 'Без романтической линии', 'Romantik chiziqsiz'),
  ('warning', 'Нецензурная лексика', 'Soʻkinish soʻzlari'),
  ('warning', 'Насилие', 'Zoʻravonlik'),
  ('warning', 'Упоминание смерти', 'Oʻlim haqida eslatma'),
  ('warning', 'Триггерные темы', 'Trigger mavzular'),
  ('style', 'Ангст', 'Angst'),
  ('style', 'Флафф', 'Flaff'),
  ('style', 'Юмор', 'Yumor'),
  ('style', 'Экшн', 'Ekshn'),
  ('style', 'Хёрт/комфорт', 'Hyort/komfort')
on conflict (category, label_ru) do nothing;

insert into achievements (code, title_ru, title_uz, description_ru, description_uz, metric, threshold) values
  ('first_story', 'Первая история', 'Birinchi hikoya', 'Опубликуйте первую историю', 'Birinchi hikoyangizni chop eting', 'story_count', 1),
  ('five_stories', '5 историй', '5 ta hikoya', 'Опубликуйте пять историй', 'Beshta hikoya chop eting', 'story_count', 5),
  ('rising_author', 'Растущий автор', 'Oʻsayotgan muallif', '100 подписчиков', '100 ta obunachi', 'follower_count', 100),
  ('reader_favorite', 'Любимец читателей', 'Oʻquvchilar sevimlisi', '1000 суммарных лайков', 'Jami 1000 ta layk', 'total_likes', 1000),
  ('consistent_author', 'Стабильный автор', 'Barqaror muallif', 'Публикации 4 недели подряд', 'Ketma-ket 4 hafta chop etish', 'publish_streak_weeks', 4)
on conflict (code) do nothing;

-- =============================================================================
-- ИСТОРИЯ ИЗМЕНЕНИЙ
-- =============================================================================
-- Формат новой записи:
--   [ГГГГ-ММ-ДД] Что изменилось. Зачем. Номер соответствующей миграции.
--
-- [2026-08-24] Первая версия файла. Объединяет миграции 0001-0007:
--   схема таблиц, RLS-политики, storage-бакеты (covers/avatars),
--   стартовые теги и достижения, триггер автосоздания профиля,
--   telegram_id/onboarded_at на profiles, RPC increment_view_counts.
-- [2026-08-24] chapters.updated_at (миграция 0008). Автор теперь может
--   редактировать уже опубликованные главы (заголовок/текст/теги/обложку/
--   жанр/описание истории) — нужна была дата последнего изменения главы,
--   у stories она уже была.
-- [2026-08-24] Исправлен bump_story_counters() (миграция 0009). Баг с самого
--   первого варианта функции: new.target_type проверялось в общем
--   and-условии, из-за чего insert в comments и bookmarks падал с ошибкой
--   "record \"new\" has no field \"target_type\"" и откатывался целиком —
--   комментарии и закладки молча никогда не сохранялись. Нашли через прямую
--   проверку insert в базе (0 комментариев при том что пользователь пробовал
--   несколько раз). Исправлено вложенным if вместо составного условия.
