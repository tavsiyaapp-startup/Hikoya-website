import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { Header } from "@/components/layout/Header";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

// An address that matches no page at all. It renders outside the (site)
// layout, so it brings the same header, menu and footer itself.
export default async function NotFound() {
  const [t, user] = await Promise.all([getServerLocale().then(getDictionary), getCurrentUser()]);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Header user={user} />
      <TopNav user={user} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-14 lg:px-9">
        <NotFoundContent t={t} />
      </main>
      <Footer />
    </div>
  );
}
