-- Backs the home page's "Новые главы за неделю" section: one row per story
-- that published at least one chapter in the last `days_back` days, newest
-- first, with an actual 7-day window (the section's own label always
-- promised this, but getRecentPublishedChapters never filtered by date —
-- it just paginated raw chapters regardless of age). total_count is a
-- window function over the grouped rows, so pagination totals reflect the
-- number of distinct STORIES, matching what's actually rendered (one card
-- per story) instead of the number of raw chapter rows. Joins stories to
-- keep out chapters whose parent story isn't itself status='published'
-- (admin-hidden, or author-soft-deleted — both flip the story back to
-- 'draft' without touching its individual chapters' own status) — the old
-- query applied this same check, so a story dropping out mid-scroll here
-- isn't new behavior, just preserved through the rewrite.
create or replace function recent_chapter_stories(
  days_back int default 7,
  page_limit int default 6,
  page_offset int default 0
) returns table (
  story_id uuid,
  chapter_count bigint,
  latest_published_at timestamptz,
  total_count bigint
) as $$
  select
    c.story_id,
    count(*) as chapter_count,
    max(c.published_at) as latest_published_at,
    count(*) over () as total_count
  from chapters c
  join stories s on s.id = c.story_id
  where c.status = 'published'
    and c.published_at >= now() - (days_back || ' days')::interval
    and s.status = 'published'
  group by c.story_id
  order by max(c.published_at) desc
  limit page_limit offset page_offset;
$$ language sql stable;

grant execute on function recent_chapter_stories(int, int, int) to anon, authenticated;
