-- Hikoya schema: profiles, stories, chapters, social graph, collections, tags,
-- achievements, requests, reports, platform settings.
-- Mirrors src/types/database.ts — keep both in sync when editing.

create extension if not exists "pgcrypto";

-- ── enums ──────────────────────────────────────────────────────────────────

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
  is_free boolean not null default false,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (story_id, order_index)
);

create index chapters_story_id_idx on chapters (story_id);

-- ── social graph ───────────────────────────────────────────────────────────

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

-- ── tags ───────────────────────────────────────────────────────────────────

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

-- ── collections ────────────────────────────────────────────────────────────

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

-- ── achievements ───────────────────────────────────────────────────────────

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

-- ── requests board ─────────────────────────────────────────────────────────

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

-- ── reports ────────────────────────────────────────────────────────────────

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ── platform settings (singleton) ─────────────────────────────────────────

create table platform_settings (
  id integer primary key default 1,
  guest_free_chapters integer not null default 1,
  enabled_locales content_language[] not null default '{ru,uz}',
  comments_require_approval boolean not null default false,
  new_story_requires_review boolean not null default false,
  check (id = 1)
);

insert into platform_settings (id) values (1);

-- ── denormalized counters ──────────────────────────────────────────────────

create or replace function bump_story_counters() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'likes' and new.target_type = 'story' then
      update stories set like_count = like_count + 1 where id = new.target_id;
    elsif tg_table_name = 'bookmarks' then
      update stories set bookmark_count = bookmark_count + 1 where id = new.story_id;
    elsif tg_table_name = 'comments' then
      update stories set comment_count = comment_count + 1
        where id = (select story_id from chapters where id = new.chapter_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if tg_table_name = 'likes' and old.target_type = 'story' then
      update stories set like_count = greatest(like_count - 1, 0) where id = old.target_id;
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
