-- Отдельная картинка для мобильной версии слайда баннера. Необязательно —
-- если не задана, мобильная версия показывает ту же картинку, что и
-- десктопная (HeroCarousel.tsx Slide(): slide.image_url_mobile || slide.image_url).
alter table hero_slides add column image_url_mobile text;
