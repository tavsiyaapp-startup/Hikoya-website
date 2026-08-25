-- Moderation now happens entirely inside the admin panel (a dedicated
-- read-only review screen, not the author's edit page) and a rejection
-- needs to carry a reason back to the author so they know what to fix
-- before resubmitting. Adds one nullable column per table; cleared on
-- approve/resubmit, set on reject.

alter table stories add column rejection_reason text;
alter table chapters add column rejection_reason text;
