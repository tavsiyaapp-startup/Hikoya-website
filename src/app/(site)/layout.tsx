import { Header } from "@/components/layout/Header";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { BackButton } from "@/components/layout/BackButton";
import { getCurrentUser } from "@/lib/current-user";
import { getPendingAnnouncement, getUnreadNotificationCount } from "@/lib/queries/notifications";
import { AnnouncementPopup } from "@/components/notifications/AnnouncementPopup";
import { getPaywallState } from "@/lib/queries/paywall";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [unreadCount, announcement] = user
    ? await Promise.all([getUnreadNotificationCount(user.id), getPendingAnnouncement(user.id)])
    : [0, null];

  // «Obuna» switched on with a start date ahead: a notice above the header
  // until it starts.
  const paywall = await getPaywallState();
  const locale = await getServerLocale();
  const paywallNotice =
    paywall.announced && paywall.config?.startsAt
      ? getDictionary(locale)
          .paywall.announce.replace("{date}", formatDateTime(paywall.config.startsAt.toISOString(), locale))
          .replace("{n}", String(paywall.config.readerFreeChapters))
      : null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {paywallNotice && (
        <div className="bg-ink px-4 py-2 text-center text-[13px] font-semibold leading-snug text-card">{paywallNotice}</div>
      )}
      <Header user={user} unreadCount={unreadCount} />
      <TopNav user={user} />
      {/* pb-24 on phones: room below the last block for the floating menu button (TopNav), which otherwise covered buttons like "Вы подписаны" at the end of a page. */}
      <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-14 lg:px-9 lg:pb-18 lg:pt-7">
        <BackButton />
        {children}
      </main>
      <Footer />
      {announcement && <AnnouncementPopup id={announcement.id} message={announcement.message} />}
    </div>
  );
}
