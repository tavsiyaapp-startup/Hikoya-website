-- Optional click-through URL for announcement cards (0048) — the whole
-- card becomes a link when set, same idea as hero_slides' cta_url.

alter table announcements add column link_url text;
