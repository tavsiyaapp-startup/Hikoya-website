-- Staff-curated "top" picks shown on the homepage (Топ дня/недели/месяца)
-- and boosted to the front of matching search results. A story can be
-- pinned into more than one tier at once — each is an independent toggle,
-- not a single three-way choice. Ordering within a tier (and among boosted
-- search results) is "first pinned, first shown": featured_at records when
-- the tier was turned on, sorted ascending.

create type story_top_tier as enum ('day', 'week', 'month');

create table featured_stories (
  story_id uuid not null references stories (id) on delete cascade,
  tier story_top_tier not null,
  featured_at timestamptz not null default now(),
  primary key (story_id, tier)
);

create index featured_stories_tier_idx on featured_stories (tier, featured_at);

alter table featured_stories enable row level security;
create policy "featured_stories are publicly readable" on featured_stories for select using (true);
create policy "staff manage featured_stories" on featured_stories for all using (is_staff()) with check (is_staff());
