-- bump_story_counters() referenced new.target_type inside a single boolean
-- expression ("tg_table_name = 'likes' and new.target_type = 'story'") that
-- ran on every invocation regardless of which table fired the trigger.
-- Postgres resolves record field access against the actual NEW row type
-- before the AND can short-circuit, so any insert/delete on bookmarks or
-- comments (neither has a target_type column) failed with
-- 'record "new" has no field "target_type"' and rolled back the whole
-- insert — comments and bookmarks were silently never being saved.
-- Fix: nest the target_type check inside its own tg_table_name = 'likes'
-- branch so it's never evaluated against the wrong row type.

create or replace function bump_story_counters() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'likes' then
      if new.target_type = 'story' then
        update stories set like_count = like_count + 1 where id = new.target_id;
      end if;
    elsif tg_table_name = 'bookmarks' then
      update stories set bookmark_count = bookmark_count + 1 where id = new.story_id;
    elsif tg_table_name = 'comments' then
      update stories set comment_count = comment_count + 1
        where id = (select story_id from chapters where id = new.chapter_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if tg_table_name = 'likes' then
      if old.target_type = 'story' then
        update stories set like_count = greatest(like_count - 1, 0) where id = old.target_id;
      end if;
    elsif tg_table_name = 'bookmarks' then
      update stories set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.story_id;
    elsif tg_table_name = 'comments' then
      update stories set comment_count = greatest(comment_count - 1, 0)
        where id = (select story_id from chapters where id = old.chapter_id);
    end if;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;
