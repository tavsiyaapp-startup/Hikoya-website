-- Telegram registration/login removed — this queue table only ever backed
-- the deep-link bot login flow, no user-facing data lives here.
drop table if exists telegram_login_tokens;
