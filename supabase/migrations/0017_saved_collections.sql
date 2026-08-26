-- Lets a reader bookmark someone else's (or editorial's) collection into
-- their own "Сохранённые подборки" tab — separate from owning a collection.

create table saved_collections (
  user_id uuid not null references profiles (id) on delete cascade,
  collection_id uuid not null references collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

alter table saved_collections enable row level security;
create policy "users manage their own saved collections" on saved_collections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
