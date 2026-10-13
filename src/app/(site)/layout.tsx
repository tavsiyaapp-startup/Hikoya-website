import { Header } from "@/components/layout/Header";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { BackButton } from "@/components/layout/BackButton";
import { getCurrentUser } from "@/lib/current-user";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unreadCount = user ? await getUnreadNotificationCount(user.id) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} unreadCount={unreadCount} />
      <TopNav user={user} />
      {/* pb-24 on phones: room below the last block for the floating menu button (TopNav), which otherwise covered buttons like "Вы подписаны" at the end of a page. */}
      <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-14 lg:px-9 lg:pb-18 lg:pt-7">
        <BackButton />
        {children}
      </main>
      <Footer />
    </div>
  );
}
