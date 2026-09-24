import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { OFFER_HTML_RU, OFFER_HTML_UZ } from "@/lib/content/offer";

export default async function OfferPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const html = locale === "uz" ? OFFER_HTML_UZ : OFFER_HTML_RU;

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-5 text-[26px] font-extrabold tracking-tight">{t.footer.offer}</h1>
      <div className="rounded-[14px] border border-border bg-card p-6 sm:p-8">
        <div className="rich-content text-[14.5px] leading-relaxed text-ink-soft" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
