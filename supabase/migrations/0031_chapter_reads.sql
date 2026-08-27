-- Per-chapter "has this user read this" flag — separate from
-- reading_progress (one row per user+story, tracks the *last* chapter
-- visited, used for the story page's continue-reading button). This tracks
-- every individual chapter a user has ever opened, so the chapters list can
-- mark each one as read. Insert-only: first view sets it, later views are
-- no-ops (see recordChapterView's ignoreDuplicates upsert) — nothing to
-- update or delete, so no update/delete policy either.
create table chapter_reads (
  user_id uuid not null references profiles (id) on delete cascade,
  chapter_id uuid not null references chapters (id) on delete cascade,
  story_id uuid not null references stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create index chapter_reads_user_story_idx on chapter_reads (user_id, story_id);

alter table chapter_reads enable row level security;
create policy "users read their own chapter_reads" on chapter_reads for select using (user_id = auth.uid());
create policy "users insert their own chapter_reads" on chapter_reads for insert with check (user_id = auth.uid());
