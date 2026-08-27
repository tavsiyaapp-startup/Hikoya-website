import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";

export default async function MissionPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-5 text-[26px] font-extrabold tracking-tight">{t.footer.mission}</h1>
      <div className="rounded-[20px] border border-border bg-card p-6 sm:p-8">
        <p className="text-[14.5px] leading-relaxed text-ink-soft">{t.staticPages.placeholder}</p>
      </div>
    </div>
  );
}
