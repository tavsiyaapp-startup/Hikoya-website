-- chapter_count: denormalized count of a story's PUBLISHED chapters, same
-- pattern as like_count/comment_count/bookmark_count (bump_story_counters()
-- below is a dedicated trigger, not folded into bump_story_counters()
-- itself, since it's the only one of these that needs to react to UPDATE —
-- a chapter's status moves in and out of 'published' via review/hide flows
-- on the same row, not just insert/delete).
alter table stories add column chapter_count integer not null default 0;

update stories set chapter_count = (
  select count(*) from chapters where chapters.story_id = stories.id and chapters.status = 'published'
);

create or replace function bump_story_chapter_count() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then
      update stories set chapter_count = chapter_count + 1 where id = new.story_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'published' then
      update stories set chapter_count = greatest(chapter_count - 1, 0) where id = old.story_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'published' and old.status != 'published' then
        update stories set chapter_count = chapter_count + 1 where id = new.story_id;
      elsif old.status = 'published' and new.status != 'published' then
        update stories set chapter_count = greatest(chapter_count - 1, 0) where id = new.story_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger chapters_bump_story_chapter_count
  after insert or update or delete on chapters
  for each row execute function bump_story_chapter_count();

-- Author-declared "is this finished, ongoing, or abandoned" — independent
-- of story_status (draft/published/unlisted/pending_review, the publishing
-- workflow state). Previously the story page badge faked this off
-- story_status itself ('published' → "ongoing" else "finished"), which was
-- just wrong (an unlisted-but-still-being-written story would show as
-- "finished"), and the search "Статус" filter used story_status the same
-- broken way, permanently matching zero results for one of its two options
-- (searchStories always requires status='published' first, so filtering by
-- status='unlisted' on top could never match anything).
create type story_progress_status as enum ('ongoing', 'finished', 'dropped');
alter table stories add column progress_status story_progress_status not null default 'ongoing';
