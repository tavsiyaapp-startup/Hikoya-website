-- Phone number collection turned out to be unnecessary — staff reply
-- straight through the bot (/reply <n> <text> in the group), and the
-- Telegram user id + username already identify who to message back. That
-- removes the only thing telegram_support_sessions.awaiting_phone tracked,
-- so the whole table goes with it.

drop table telegram_support_sessions;
alter table telegram_support_tickets drop column phone;
