-- Starter tag vocabulary and author achievements.
-- Age rating is its own column on stories (0+/12+/16+/18+), so no
-- 'age_rating' category tags are seeded here — only the multi-select
-- categories (genre/relationship/warning/style) that stories can carry
-- several of. Admins can add/edit rows in `tags` and `achievements` later.

insert into tags (category, label_ru, label_uz) values
  ('genre', 'Романтика', 'Romantika'),
  ('genre', 'Фэнтези', 'Fentezi'),
  ('genre', 'Детектив', 'Detektiv'),
  ('genre', 'Драма', 'Drama'),
  ('genre', 'Научная фантастика', 'Ilmiy fantastika'),
  ('genre', 'Ужасы', 'Qoʻrqinchli'),
  ('genre', 'Исторические', 'Tarixiy'),
  ('genre', 'Мифология', 'Mifologiya'),
  ('genre', 'Подростковые', 'Oʻsmirlar uchun'),
  ('genre', 'Другое', 'Boshqa'),
  ('relationship', 'Разнополые отношения', 'Turli jinsdagilar munosabati'),
  ('relationship', 'Однополые отношения', 'Bir jinsdagilar munosabati'),
  ('relationship', 'Множественные пары', 'Bir nechta juftlik'),
  ('relationship', 'Без романтической линии', 'Romantik chiziqsiz'),
  ('warning', 'Нецензурная лексика', 'Soʻkinish soʻzlari'),
  ('warning', 'Насилие', 'Zoʻravonlik'),
  ('warning', 'Упоминание смерти', 'Oʻlim haqida eslatma'),
  ('warning', 'Триггерные темы', 'Trigger mavzular'),
  ('style', 'Ангст', 'Angst'),
  ('style', 'Флафф', 'Flaff'),
  ('style', 'Юмор', 'Yumor'),
  ('style', 'Экшн', 'Ekshn'),
  ('style', 'Хёрт/комфорт', 'Hyort/komfort')
on conflict (category, label_ru) do nothing;

insert into achievements (code, title_ru, title_uz, description_ru, description_uz, metric, threshold) values
  ('first_story', 'Первая история', 'Birinchi hikoya', 'Опубликуйте первую историю', 'Birinchi hikoyangizni chop eting', 'story_count', 1),
  ('five_stories', '5 историй', '5 ta hikoya', 'Опубликуйте пять историй', 'Beshta hikoya chop eting', 'story_count', 5),
  ('rising_author', 'Растущий автор', 'Oʻsayotgan muallif', '100 подписчиков', '100 ta obunachi', 'follower_count', 100),
  ('reader_favorite', 'Любимец читателей', 'Oʻquvchilar sevimlisi', '1000 суммарных лайков', 'Jami 1000 ta layk', 'total_likes', 1000),
  ('consistent_author', 'Стабильный автор', 'Barqaror muallif', 'Публикации 4 недели подряд', 'Ketma-ket 4 hafta chop etish', 'publish_streak_weeks', 4)
on conflict (code) do nothing;
