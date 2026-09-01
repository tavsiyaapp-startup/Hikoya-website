-- Слайд без фото — "письмо от создателей" на градиентном фоне (существующий
-- фон карточки слайда). image_url становится необязательным.
alter table hero_slides alter column image_url drop not null;

-- Первый слайд карусели — обращение от создателей платформы. created_at
-- выставлен раньше самой ранней существующей строки, чтобы попасть первым
-- при сортировке "order by created_at ascending" (getHeroSlides).
insert into hero_slides (title_ru, title_uz, body_ru, body_uz, image_url, created_at)
values (
  'Небольшое пространство, созданное для авторов. 🤍',
  'Ijodkorlar uchun yaratilgan kichik bir makon. 🤍',
  'Мы, как и вы, две самые обычные семейные женщины, влюблённые в творчество.
Мы создали эту платформу для тех, кто, как и мы, пишет, читает и хочет поделиться своей историей с миром.
Здесь вы найдёте своих первых читателей, откроете новые истории и поддержите авторов.
Мы только начинаем.
А ваша поддержка способна превратить этот стартап в большую историю.',
  'Biz ham siz kabi ijodga oshno bo‘lgan ikki oddiy oilali qizmiz.
O‘zimiz kabi yozadigan, o‘qiydigan va o‘z hikoyasini dunyo bilan bo‘lishishni istaydigan insonlar uchun ushbu platformani yaratdik.
Bu yerda ilk o‘quvchilaringizni toping, yangi hikoyalarni kashf eting va ijodkorlarni qo‘llab-quvvatlang.
Biz endi boshlayapmiz.
Sizning qo‘llab-quvvatlashingiz esa bu startup ni katta hikoyaga aylantirishi mumkin.',
  null,
  coalesce((select min(created_at) - interval '1 second' from hero_slides), now())
);
