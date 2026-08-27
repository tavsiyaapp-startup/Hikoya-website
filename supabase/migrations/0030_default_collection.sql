-- Every user gets a default "Моя подборка" collection at signup, same
-- trigger that already stubs their profiles row.
create or replace function handle_new_user() returns trigger as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''),
    'user'
  );
  candidate := base_username;

  while exists (select 1 from profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'full_name', candidate));

  insert into collections (owner_id, owner_type, title)
  values (new.id, 'user', 'Моя подборка');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill: give every existing user their default collection too, if they
-- don't already happen to have one with this exact title.
insert into collections (owner_id, owner_type, title)
select p.id, 'user', 'Моя подборка'
from profiles p
where not exists (
  select 1 from collections c where c.owner_id = p.id and c.title = 'Моя подборка'
);
