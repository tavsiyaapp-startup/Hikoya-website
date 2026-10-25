import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/server/auth/staff";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getUnreadAdminChatsCount } from "@/lib/queries/chat";
import { getOpenReportsCount } from "@/lib/queries/admin";
import { getDb } from "@/server/db/client";
import { countOpenForumReports } from "@/server/data/forum";
import { countPendingClaims } from "@/server/data/paywall";
import { ROUTES } from "@/lib/constants";
import { ShieldIcon, UserIcon, CollectionsIcon, BoardIcon, HomeIcon, LibraryIcon, SparkleIcon, ImageIcon, ClockIcon, MessageIcon, CommentsIcon, BellIcon, SendIcon, LockIcon } from "@/components/ui/icons";
import { AdminNavLink } from "./AdminNavLink";
import { AdminSignOutLink } from "./AdminSignOutLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already gates every /admin* request the same way — this is
  // defense in depth for a direct render that somehow skips the
  // middleware, same as before this cutover.
  const result = await getStaffSession();
  if (result.status === "signed-out") redirect(ROUTES.adminLogin);
  if (result.status === "not-staff") redirect(ROUTES.home);

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const isAdmin = result.staff.isAdmin;
  const [unreadChats, openReports, openForumReports, pendingPayments] = await Promise.all([
    getUnreadAdminChatsCount(),
    getOpenReportsCount(),
    countOpenForumReports(getDb()).catch(() => 0),
    isAdmin ? Promise.resolve().then(() => countPendingClaims(getDb())).catch(() => 0) : Promise.resolve(0),
  ]);

  const nav = [
    { href: ROUTES.admin, icon: HomeIcon, label: t.admin.dashboard },
    { href: `${ROUTES.admin}/stories`, icon: CollectionsIcon, label: t.admin.stories },
    { href: `${ROUTES.admin}/users`, icon: UserIcon, label: t.admin.users },
    { href: `${ROUTES.admin}/activity`, icon: ClockIcon, label: t.admin.recentActivity },
    { href: ROUTES.adminChats(), icon: MessageIcon, label: t.admin.chats, badge: unreadChats },
    { href: ROUTES.adminComments, icon: CommentsIcon, label: t.admin.comments },
    { href: ROUTES.adminReports, icon: ShieldIcon, label: t.admin.reports, badge: openReports },
    { href: `${ROUTES.admin}/featured`, icon: SparkleIcon, label: t.admin.featured },
    { href: `${ROUTES.admin}/banner`, icon: ImageIcon, label: t.admin.banner },
    { href: `${ROUTES.admin}/announcements`, icon: BellIcon, label: t.admin.announcements },
    { href: `${ROUTES.admin}/broadcast`, icon: SendIcon, label: t.admin.broadcastTitle },
    { href: ROUTES.adminForum, icon: BoardIcon, label: t.admin.forum, badge: openForumReports },
    { href: `${ROUTES.admin}/collections`, icon: LibraryIcon, label: t.admin.collections },
    // «Obuna» is about money — admins only.
    ...(isAdmin ? [{ href: `${ROUTES.admin}/subscriptions`, icon: LockIcon, label: t.paywall.adminTitle, badge: pendingPayments }] : []),
    { href: `${ROUTES.admin}/settings`, icon: ShieldIcon, label: t.admin.settings },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col items-stretch lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-ink-darker px-4.5 py-4 lg:sticky lg:top-3 lg:m-3 lg:mr-0 lg:h-[calc(100dvh-1.5rem)] lg:w-62 lg:overflow-y-auto lg:rounded-[24px] lg:py-6.5 lg:shadow-[0_30px_60px_-30px_rgba(20,16,31,0.6)]">
        <div className="mb-4 flex items-center gap-3 lg:mb-8.5">
          <div className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl bg-white/90">
            <Image src="/images/logo.png" alt="" width={32} height={32} className="object-contain" />
          </div>
          <div>
            <div className="font-script text-xl leading-tight text-white">{t.common.brand}</div>
            <div className="text-[11.5px] text-[#8B82A8]">{t.nav.admin}</div>
          </div>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
          {nav.map((item) => (
            <AdminNavLink key={item.href} href={item.href} label={item.label} badge={"badge" in item ? item.badge : undefined}>
              <item.icon width={20} height={20} />
            </AdminNavLink>
          ))}
        </nav>

        <Link prefetch={false}
          href={ROUTES.home}
          className="mt-3 flex h-11.5 shrink-0 items-center gap-3 rounded-full px-3.5 text-[14.5px] font-semibold text-[#8B82A8] transition hover:bg-white/8 hover:text-white lg:mt-auto"
        >
          ← {t.nav.home}
        </Link>
        <AdminSignOutLink label={t.admin.signOut} />
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
