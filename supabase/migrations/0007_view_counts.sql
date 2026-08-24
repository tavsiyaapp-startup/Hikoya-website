-- Atomic view-count bump, called from the reader page via the service-role
-- client (view_count has no public RLS write policy on purpose).

create or replace function increment_view_counts(p_chapter_id uuid, p_story_id uuid) returns void as $$
begin
  update chapters set view_count = view_count + 1 where id = p_chapter_id;
  update stories set view_count = view_count + 1 where id = p_story_id;
end;
$$ language plpgsql security definer;
