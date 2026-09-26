-- Optional social handles a user can add to their own profile (Instagram,
-- Telegram) — plain handles, not full URLs (the profile page builds the
-- link). Icon just doesn't render on the author page when unset.

alter table profiles add column instagram_handle text;
alter table profiles add column telegram_handle text;
