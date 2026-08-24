-- Telegram sign-in needs a way to find/link a profile without an email
-- (the widget only gives us a numeric Telegram user id), and onboarding
-- needs a marker for "has this user finished the 3-step wizard".

alter table profiles add column telegram_id bigint unique;
alter table profiles add column onboarded_at timestamptz;
