-- Support/feedback Telegram bot (webhook-driven, see
-- src/app/api/telegram/support/route.ts). Modeled on a reference bot the
-- user already runs elsewhere (D:\proekti\SN\sninvestuzbot, aiogram +
-- in-memory dicts + long-polling): user DMs the bot with text/photo/video,
-- taps "send" once done, gives a phone number, and everything gets
-- forwarded to a staff group chat as a numbered ticket; staff reply with
-- /reply <n> <text> in that group and the bot relays it back to the user's
-- DM. Long-polling + in-process dicts don't work on Vercel's serverless
-- model, so this is a webhook instead, and the in-memory state
-- (pending/awaiting_phone/ticket counter) becomes these three tables.
-- Nothing here is tied to a Hikoya account — these are raw Telegram user
-- ids, reachable by anyone who DMs the bot, registered or not. Only the
-- webhook route (service-role client) ever touches these tables — no
-- browser/admin UI reads them, staff work entirely from the Telegram group
-- chat itself, matching the reference bot's scope exactly. RLS is enabled
-- with no policies (service role bypasses it) purely so a future public
-- API surface can never accidentally expose them.

create table telegram_support_pending_messages (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  chat_id bigint not null,
  message_id bigint not null,
  created_at timestamptz not null default now()
);
create index telegram_support_pending_messages_user_idx on telegram_support_pending_messages (telegram_user_id);

create table telegram_support_sessions (
  telegram_user_id bigint primary key,
  awaiting_phone boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ticket_number is a real Postgres identity column specifically so
-- concurrent submissions get atomic, gap-free numbering for free — the
-- reference bot's itertools.count() only worked because it had a single
-- always-running process; a serverless webhook has no equivalent.
create table telegram_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number integer generated always as identity,
  telegram_user_id bigint not null,
  telegram_username text,
  telegram_full_name text,
  phone text not null,
  created_at timestamptz not null default now()
);
create unique index telegram_support_tickets_number_idx on telegram_support_tickets (ticket_number);
create index telegram_support_tickets_user_idx on telegram_support_tickets (telegram_user_id);

alter table telegram_support_pending_messages enable row level security;
alter table telegram_support_sessions enable row level security;
alter table telegram_support_tickets enable row level security;
