-- Hero banner slide 1 stops being hardcoded JSX and becomes a normal
-- hero_slides row, so it's editable/deletable from /admin/banner exactly
-- like every other slide (uniform template = uniform on-screen size).
-- Title/body become optional per slide — an admin can leave them blank and
-- the slide is just a full-bleed image (see GenericSlide in HeroCarousel.tsx).

alter table hero_slides alter column title_ru drop not null;
alter table hero_slides alter column title_uz drop not null;
alter table hero_slides alter column body_ru drop not null;
alter table hero_slides alter column body_uz drop not null;

-- Seed the former hardcoded slide 1 as a real row (only if the table is
-- still empty) so the homepage keeps showing exactly what it showed before,
-- now as ordinary, editable data. image_url points at the same local asset
-- the JSX used to reference — no Storage upload needed for it to render.
insert into hero_slides (title_ru, title_uz, body_ru, body_uz, image_url, cta_label_ru, cta_label_uz, cta_url)
select
  'Публикуй свои истории. Находи своих читателей.',
  'Hikoyalaringizni chiqaring. Oʻquvchilaringizni toping.',
  'Первые главы любой истории открыты без регистрации. Читайте, а когда захочется продолжить — создайте аккаунт.',
  'Har qanday hikoyaning birinchi boblari roʻyxatdan oʻtmasdan ochiq. Oʻqing, davom etishni xohlasangiz — akkaunt yarating.',
  '/images/banner-write.jpg',
  'Опубликовать историю',
  'Hikoya chiqarish',
  '/create'
where not exists (select 1 from hero_slides);
