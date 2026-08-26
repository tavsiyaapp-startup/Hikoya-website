import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllHeroSlidesAdmin } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { HeroSlideForm } from "./HeroSlideForm";
import { HeroSlideListItem } from "./HeroSlideListItem";

export default async function AdminBannerPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const slides = await getAllHeroSlidesAdmin();

  return (
    <div>
      <AdminHeader title={t.admin.banner} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-5 rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <p className="mb-5 text-[13.5px] text-muted-2">{t.admin.bannerHint}</p>
          <HeroSlideForm />
        </div>

        <div className="rounded-[22px] border border-border bg-card p-4.5 sm:p-6.5">
          <h3 className="mb-3 text-[15px] font-extrabold">{t.admin.bannerCurrentSlides}</h3>
          {slides.length > 0 ? (
            slides.map((slide) => (
              <HeroSlideListItem key={slide.id} slide={slide} canDelete={slides.length > 1} />
            ))
          ) : (
            <div className="py-6 text-center text-[13.5px] text-muted">{t.admin.bannerNoSlidesYet}</div>
          )}
        </div>
      </div>
    </div>
  );
}
