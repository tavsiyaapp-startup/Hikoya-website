import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";

// No admin UI for this yet (deliberately kept simple) — add entries here
// directly, newest first, when there's something to announce.
const NEWS_ITEMS: { date: string; title: { ru: string; uz: string }; body: { ru: string; uz: string } }[] = [];

export default async function NewsPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-5 text-[26px] font-extrabold tracking-tight">{t.footer.news}</h1>

      {NEWS_ITEMS.length === 0 ? (
        <div className="rounded-[20px] border border-border bg-card p-6 text-center sm:p-8">
          <p className="text-[14.5px] text-muted">{t.staticPages.newsEmpty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {NEWS_ITEMS.map((item) => (
            <div key={item.date} className="rounded-[20px] border border-border bg-card p-6 sm:p-8">
              <div className="mb-1.5 text-[12.5px] font-semibold text-muted-2">{item.date}</div>
              <h2 className="mb-2 text-[17px] font-extrabold">{item.title[locale]}</h2>
              <p className="text-[14.5px] leading-relaxed text-ink-soft">{item.body[locale]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
