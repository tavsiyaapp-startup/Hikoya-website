-- Admin ↔ user support chat: one shared thread per user, continuable by any
-- admin/moderator (not a separate thread per staff member) — a user's
-- messages and every staff reply live in the same admin_chat_messages rows
-- keyed by user_id. admin_chats holds one summary row per user for a fast
-- admin-side chat list and unread badges, without aggregating messages.

alter type notification_type add value 'admin_message';

create table admin_chats (
  user_id uuid primary key references profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_sender_is_admin boolean not null default false,
  unread_by_admin boolean not null default false,
  unread_by_user boolean not null default false
);

create table admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  is_admin boolean not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index admin_chat_messages_user_id_idx on admin_chat_messages (user_id, created_at);
create index admin_chats_unread_by_admin_idx on admin_chats (unread_by_admin) where unread_by_admin;

-- Both tables are only ever written through server actions on the
-- service-role client (same pattern as tags/custom_languages) — a plain
-- authenticated client can only ever SELECT, never write directly.
alter table admin_chats enable row level security;
create policy "users and staff can read admin_chats" on admin_chats for select using (
  user_id = auth.uid() or is_staff()
);

alter table admin_chat_messages enable row level security;
create policy "users and staff can read admin_chat_messages" on admin_chat_messages for select using (
  user_id = auth.uid() or is_staff()
);
