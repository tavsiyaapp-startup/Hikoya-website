-- Manual "shelf" status a reader sets on a story — separate from
-- reading_progress (which is auto-tracked percent from chapter views).
-- A story can have both, neither, or either independently: you can mark
-- "хочу прочитать" before ever opening a chapter, or "прочитано"/"брошено"
-- regardless of what percent reading_progress last recorded.

create type reading_status as enum ('want_to_read', 'read', 'dropped');

create table reading_statuses (
  user_id uuid not null references profiles (id) on delete cascade,
  story_id uuid not null references stories (id) on delete cascade,
  status reading_status not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index reading_statuses_user_status_idx on reading_statuses (user_id, status);

alter table reading_statuses enable row level security;
create policy "users manage their own reading statuses" on reading_statuses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
