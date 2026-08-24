-- Row Level Security for every table created in 0001_schema.sql.
-- Guest chapter gating (how many free chapters an anonymous reader sees) is
-- NOT enforced here — RLS allows public read of published chapters, and the
-- /story/[slug]/[chapter] route decides server-side whether to render the
-- full text or a locked stub, per platform_settings.guest_free_chapters.

create or replace function is_staff() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'moderator')
  );
$$ language sql security definer stable;

-- ── profiles ───────────────────────────────────────────────────────────────

alter table profiles enable row level security;

create policy "profiles are publicly readable"
  on profiles for select using (true);

create policy "users insert their own profile"
  on profiles for insert with check (id = auth.uid());

create policy "users update their own profile"
  on profiles for update using (id = auth.uid() or is_staff());

-- ── stories ────────────────────────────────────────────────────────────────

alter table stories enable row level security;

create policy "published public stories are readable"
  on stories for select using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or author_id = auth.uid()
    or is_staff()
  );

create policy "authors insert their own stories"
  on stories for insert with check (author_id = auth.uid());

create policy "authors update their own stories"
  on stories for update using (author_id = auth.uid() or is_staff());

create policy "authors delete their own stories"
  on stories for delete using (author_id = auth.uid() or is_staff());

-- ── chapters ───────────────────────────────────────────────────────────────

alter table chapters enable row level security;

create policy "published chapters of readable stories are readable"
  on chapters for select using (
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

create policy "story owners insert chapters"
  on chapters for insert with check (
    exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
  );

create policy "story owners update chapters"
  on chapters for update using (
    exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
    or is_staff()
  );

create policy "story owners delete chapters"
  on chapters for delete using (
    exists (select 1 from stories where stories.id = story_id and stories.author_id = auth.uid())
    or is_staff()
  );

-- ── comments ───────────────────────────────────────────────────────────────

alter table comments enable row level security;

create policy "comments on readable chapters are readable"
  on comments for select using (
    exists (
      select 1 from chapters
      where chapters.id = comments.chapter_id and chapters.status = 'published'
    )
    or is_staff()
  );

create policy "authenticated users insert their own comments"
  on comments for insert with check (user_id = auth.uid());

create policy "users update their own comments"
  on comments for update using (user_id = auth.uid() or is_staff());

create policy "users delete their own comments"
  on comments for delete using (user_id = auth.uid() or is_staff());

-- ── likes / bookmarks / reading progress (private to the user) ─────────────

alter table likes enable row level security;

create policy "users manage their own likes" on likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table bookmarks enable row level security;

create policy "users manage their own bookmarks" on bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table reading_progress enable row level security;

create policy "users manage their own reading progress" on reading_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── follows (public, so follower/following lists can be shown) ─────────────

alter table follows enable row level security;

create policy "follows are publicly readable" on follows for select using (true);

create policy "users manage their own follows" on follows for insert
  with check (follower_id = auth.uid());

create policy "users remove their own follows" on follows for delete
  using (follower_id = auth.uid());

-- ── tags / story_tags (public read, staff write) ────────────────────────────

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

-- ── collections ────────────────────────────────────────────────────────────

alter table collections enable row level security;

create policy "public collections are readable"
  on collections for select using (
    not is_private or owner_id = auth.uid() or is_staff()
  );

create policy "users insert their own collections"
  on collections for insert with check (owner_id = auth.uid());

create policy "owners update their own collections"
  on collections for update using (owner_id = auth.uid() or is_staff());

create policy "owners delete their own collections"
  on collections for delete using (owner_id = auth.uid() or is_staff());

alter table collection_items enable row level security;

create policy "collection_items follow parent collection visibility"
  on collection_items for select using (
    exists (
      select 1 from collections
      where collections.id = collection_id
        and (not collections.is_private or collections.owner_id = auth.uid() or is_staff())
    )
  );

create policy "collection owners manage items"
  on collection_items for all using (
    exists (select 1 from collections where collections.id = collection_id and collections.owner_id = auth.uid())
    or is_staff()
  ) with check (
    exists (select 1 from collections where collections.id = collection_id and collections.owner_id = auth.uid())
    or is_staff()
  );

-- ── achievements (public read, staff/system write) ──────────────────────────

alter table achievements enable row level security;

create policy "achievements are publicly readable" on achievements for select using (true);
create policy "staff manage achievements" on achievements for all using (is_staff()) with check (is_staff());

alter table user_achievements enable row level security;

create policy "user_achievements are publicly readable" on user_achievements for select using (true);
create policy "staff award achievements" on user_achievements for all using (is_staff()) with check (is_staff());

-- ── requests board ─────────────────────────────────────────────────────────

alter table requests enable row level security;

create policy "requests are publicly readable" on requests for select using (true);

create policy "users insert their own requests"
  on requests for insert with check (from_user_id = auth.uid());

create policy "requesters and staff update requests"
  on requests for update using (from_user_id = auth.uid() or is_staff());

create policy "requesters and staff delete requests"
  on requests for delete using (from_user_id = auth.uid() or is_staff());

alter table request_responses enable row level security;

create policy "request_responses are publicly readable" on request_responses for select using (true);

create policy "authors insert their own responses"
  on request_responses for insert with check (author_id = auth.uid());

create policy "authors and staff update responses"
  on request_responses for update using (author_id = auth.uid() or is_staff());

create policy "authors and staff delete responses"
  on request_responses for delete using (author_id = auth.uid() or is_staff());

-- ── reports (write by anyone, read by reporter or staff) ────────────────────

alter table reports enable row level security;

create policy "reporters and staff read reports"
  on reports for select using (reporter_id = auth.uid() or is_staff());

create policy "authenticated users file reports"
  on reports for insert with check (reporter_id = auth.uid());

create policy "staff manage reports"
  on reports for update using (is_staff());

create policy "staff delete reports"
  on reports for delete using (is_staff());

-- ── platform settings (public read, staff write) ────────────────────────────

alter table platform_settings enable row level security;

create policy "platform settings are publicly readable"
  on platform_settings for select using (true);

create policy "staff update platform settings"
  on platform_settings for update using (is_staff());
