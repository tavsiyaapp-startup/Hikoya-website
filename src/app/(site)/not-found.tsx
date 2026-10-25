import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

// notFound() from a page inside the site (a story, an author, a topic that
// doesn't exist) — shown inside the usual header and footer.
export default async function SiteNotFound() {
  const t = getDictionary(await getServerLocale());
  return <NotFoundContent t={t} />;
}
