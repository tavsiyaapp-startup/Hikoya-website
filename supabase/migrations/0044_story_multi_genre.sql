-- stories.genre was a single free-text value — authors can now pick more
-- than one genre for a story. Switches it to a text[] column (same free-
-- text values as before, just multiple), backfilling each existing row's
-- single genre into a one-element array before dropping the old column.

alter table stories add column genres text[] not null default '{}';
update stories set genres = array[genre];
alter table stories drop column genre;

drop index if exists stories_genre_idx;
create index stories_genres_idx on stories using gin (genres);
