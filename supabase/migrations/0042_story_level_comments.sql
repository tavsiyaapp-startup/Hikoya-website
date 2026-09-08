-- Комментарий теперь можно оставить не только к конкретной главе, но и в
-- общем разделе "Комментарии" на странице произведения (все главы разом).
-- comments.story_id — обязательное поле для быстрого фильтра/RLS без join
-- через chapters; chapter_id становится необязательным (null = общий
-- комментарий, не привязан к главе).
alter table comments add column story_id uuid references stories (id) on delete cascade;
update comments set story_id = chapters.story_id from chapters where chapters.id = comments.chapter_id;
alter table comments alter column story_id set not null;
alter table comments alter column chapter_id drop not null;
create index comments_story_id_idx on comments (story_id);

-- Общий комментарий читается, если сама история опубликована — раньше
-- политика проверяла только главу, у общего комментария главы нет.
drop policy "comments on readable chapters are readable" on comments;
create policy "comments on readable chapters or stories are readable" on comments for select using (
  (
    chapter_id is not null
    and exists (select 1 from chapters where chapters.id = comments.chapter_id and chapters.status = 'published')
  )
  or (
    chapter_id is null
    and exists (
      select 1 from stories
      where stories.id = comments.story_id and stories.status = 'published' and stories.visibility in ('public', 'unlisted')
    )
  )
  or is_staff()
);

-- bump_story_counters() у comments раньше вычисляло story_id через
-- подзапрос к chapters по chapter_id — для общего комментария (chapter_id
-- null) это давало NULL и stories.comment_count молча не увеличивался.
-- Теперь берёт new.story_id/old.story_id напрямую; chapters.comment_count
-- трогает, только если chapter_id реально задан.
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
      update stories set comment_count = comment_count + 1 where id = new.story_id;
      if new.chapter_id is not null then
        update chapters set comment_count = comment_count + 1 where id = new.chapter_id;
      end if;
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
      update stories set comment_count = greatest(comment_count - 1, 0) where id = old.story_id;
      if old.chapter_id is not null then
        update chapters set comment_count = greatest(comment_count - 1, 0) where id = old.chapter_id;
      end if;
    end if;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;
