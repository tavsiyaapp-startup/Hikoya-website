-- Staff-assignable profile badges: a verified checkmark (own boolean, shown
-- prominently next to the display name) plus a new achievement staff can
-- award manually from /admin/users, same mechanism as the existing five
-- achievements — none of which were ever actually auto-awarded by any code
-- path, so "manually assigned by staff" is the real behavior all six share.

alter table profiles add column is_verified boolean not null default false;

insert into achievements (code, title_ru, title_uz, description_ru, description_uz, metric, threshold) values
  ('author_of_month', 'Автор месяца', 'Oyning muallifi', 'Отмечен редакцией как автор месяца', 'Tahririyat tomonidan oyning muallifi deb belgilangan', 'story_count', 0)
on conflict (code) do nothing;
