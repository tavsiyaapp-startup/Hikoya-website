-- Notifications didn't exist at all — the bell icon in Header/Sidebar linked
-- to a "notifications" library tab that was never implemented. Also wires up
-- comment replies (comments.parent_id already existed but nothing ever set
-- it) and comment likes (likes.target_type already included 'comment' but
-- no action ever used it).

create type notification_type as enum (
  'new_comment',       -- someone commented on your chapter
  'comment_reply',     -- someone replied to your comment
  'comment_like',      -- someone liked your comment
  'story_approved',
  'story_rejected',
  'chapter_approved',
  'chapter_rejected'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,     -- recipient
  actor_id uuid references profiles (id) on delete set null,            -- who triggered it (null for system/moderation events)
  type notification_type not null,
  story_id uuid references stories (id) on delete cascade,
  chapter_id uuid references chapters (id) on delete cascade,
  comment_id uuid references comments (id) on delete cascade,
  message text,          -- e.g. the moderator's rejection reason
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

-- Recipients read/mark-read their own notifications directly. There is
-- deliberately no insert policy for the plain client — a notification is
-- always about a *different* user's action, so user_id != auth.uid() at
-- insert time. All inserts go through the service-role client from trusted
-- server action code (see src/lib/actions/create-notification.ts), never
-- from a client-supplied request.
create policy "users read their own notifications" on notifications for select using (user_id = auth.uid());
create policy "users update their own notifications" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
