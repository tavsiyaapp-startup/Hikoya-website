-- stories.language was a fixed content_language enum ('ru'|'uz') — authors
-- writing in another language had no way to say what it actually is.
-- Switch it to free text (like stories.genre already is), and add a small
-- registry of custom language labels so a value one author types becomes an
-- offered option for everyone afterwards (same idea as the tags table).

alter table stories alter column language drop default;
alter table stories alter column language type text using language::text;
alter table stories alter column language set default 'ru';

create table custom_languages (
  label text primary key,
  created_at timestamptz not null default now()
);

alter table custom_languages enable row level security;

create policy "custom_languages are publicly readable" on custom_languages for select using (true);
create policy "staff manage custom_languages" on custom_languages for all using (is_staff()) with check (is_staff());
