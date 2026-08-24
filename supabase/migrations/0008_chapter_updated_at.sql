-- Authors can now edit already-published chapters (title/content), so we
-- need a timestamp that actually reflects the last edit — created_at stays
-- fixed at first publish.

alter table chapters add column updated_at timestamptz not null default now();
