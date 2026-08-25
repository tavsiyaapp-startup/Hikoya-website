-- bump_story_counters() only ever handled likes with target_type = 'story'.
-- Comment likes (likes.target_type = 'comment', now used by
-- toggleCommentLike) silently no-opped through the same trigger without
-- ever touching comments.like_count. Extends both the INSERT and DELETE
-- branches to also bump the comment's own counter.

create or replace function bump_story_counters() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'likes' then
      if new.target_type = 'story' then
        update stories set like_count = like_count + 1 where id = new.target_id;
      elsif new.target_type = 'comment' then
        update comments set like_count = like_count + 1 where id = new.target_id;
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
      elsif old.target_type = 'comment' then
        update comments set like_count = greatest(like_count - 1, 0) where id = old.target_id;
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
