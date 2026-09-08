-- Views now count unique readers, not raw page loads: the caller only
-- invokes this when it has already established the chapter read is new for
-- that reader (chapter_reads for logged-in users, a guest cookie otherwise),
-- and p_bump_story is only true on that reader's first-ever chapter read of
-- the story, so the story counter reflects unique story readers rather than
-- total chapter reads.
create or replace function increment_view_counts(p_chapter_id uuid, p_story_id uuid, p_bump_story boolean default true) returns void as $$
begin
  update chapters set view_count = view_count + 1 where id = p_chapter_id;
  if p_bump_story then
    update stories set view_count = view_count + 1 where id = p_story_id;
  end if;
end;
$$ language plpgsql security definer;
