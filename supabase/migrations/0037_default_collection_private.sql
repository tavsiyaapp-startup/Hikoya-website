-- Дефолтная "Моя подборка" (0030) создавалась с is_private по умолчанию
-- (false) — то есть была видна всем в разделе "Пользователи" на /collections.
-- Должна вести себя как YouTube "Смотреть позже": приватна по умолчанию.
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

  insert into collections (owner_id, owner_type, title, is_private)
  values (new.id, 'user', 'Моя подборка', true);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill: у всех, кому эта подборка уже досталась публичной, скрываем её —
-- то же точное совпадение по названию, что и в бэкфилле 0030.
update collections
set is_private = true
where title = 'Моя подборка' and owner_type = 'user' and is_private = false;
