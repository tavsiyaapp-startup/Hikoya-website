alter table chapters add column comment_count integer not null default 0;

update chapters set comment_count = (
  select count(*) from comments where comments.chapter_id = chapters.id
);

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
      update chapters set comment_count = comment_count + 1 where id = new.chapter_id;
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
      update chapters set comment_count = greatest(comment_count - 1, 0) where id = old.chapter_id;
    end if;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;
