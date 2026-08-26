-- Backs the "Log in via Telegram bot" deep-link flow: the site creates a
-- short-lived random token, the user opens t.me/<bot>?start=<token> and
-- presses Start, our webhook (src/app/auth/telegram-webhook) receives the
-- resulting /start message and marks the token confirmed with the sender's
-- Telegram identity. The site polls this table until it flips to confirmed.

create table telegram_login_tokens (
  token text primary key,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  telegram_id bigint,
  telegram_first_name text,
  telegram_last_name text,
  telegram_username text,
  telegram_photo_url text,
  created_at timestamptz not null default now()
);

-- No client (anon or authenticated) ever reads/writes this table directly —
-- every access goes through the service-role client in the three
-- auth/telegram-* route handlers. RLS enabled with zero policies denies
-- everything except the service-role key, which bypasses RLS entirely.
alter table telegram_login_tokens enable row level security;
