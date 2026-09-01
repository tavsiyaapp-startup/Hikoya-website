-- Автор перевёл опубликованное произведение обратно в черновик (или его
-- статус стал 'unlisted'/'pending_review') — сейчас RLS полностью блокирует
-- строку для всех, кроме автора/стафа, поэтому она тихо пропадает из
-- /library и /collections/[id] (join к stories возвращает null), а не
-- показывается как недоступная. Хотим то же поведение, что уже есть для
-- мягко удалённых (deleted_at is not null, 0032): строка остаётся
-- SELECT-абельной (заголовок/обложка), чтобы карточка могла отрендерить
-- плейсхолдер "Черновик" вместо того, чтобы просто исчезнуть — полный
-- доступ к самой странице произведения по-прежнему блокируется отдельной
-- проверкой в getStoryBySlug() (главы и так недоступны через свою RLS).
alter policy "published public stories are readable" on stories
  using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or author_id = auth.uid()
    or is_staff()
    or status != 'published'
  );
