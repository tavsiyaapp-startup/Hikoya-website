-- Author-flagged spoiler comments — hidden behind a "показать спойлер"
-- reveal in the UI instead of rendering straight away.
alter table comments add column is_spoiler boolean not null default false;
