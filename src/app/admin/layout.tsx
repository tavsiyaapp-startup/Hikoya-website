import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/constants";
import { ShieldIcon, UserIcon, CollectionsIcon, BoardIcon, HomeIcon, LibraryIcon, SparkleIcon, ImageIcon } from "@/components/ui/icons";
import { AdminNavLink } from "./AdminNavLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.adminLogin);
  const isStaff = user.profile && ["admin", "moderator"].includes(user.profile.role);
  if (!isStaff) redirect(ROUTES.home);

  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const nav = [
    { href: ROUTES.admin, icon: HomeIcon, label: t.admin.dashboard },
    { href: `${ROUTES.admin}/users`, icon: UserIcon, label: t.admin.users },
    { href: `${ROUTES.admin}/stories`, icon: CollectionsIcon, label: t.admin.stories },
    { href: `${ROUTES.admin}/featured`, icon: SparkleIcon, label: t.admin.featured },
    { href: `${ROUTES.admin}/banner`, icon: ImageIcon, label: t.admin.banner },
    { href: `${ROUTES.admin}/requests`, icon: BoardIcon, label: t.admin.requests },
    { href: `${ROUTES.admin}/collections`, icon: LibraryIcon, label: t.admin.collections },
    { href: `${ROUTES.admin}/settings`, icon: ShieldIcon, label: t.admin.settings },
  ];

  return (
    <div className="flex min-h-screen flex-col items-stretch bg-bg lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-ink-darker px-4.5 py-4 lg:w-62 lg:py-6.5">
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
            <AdminNavLink key={item.href} href={item.href} label={item.label}>
              <item.icon width={20} height={20} />
            </AdminNavLink>
          ))}
        </nav>

        <Link
          href={ROUTES.home}
          className="mt-3 flex h-11.5 shrink-0 items-center gap-3 rounded-xl px-3.5 text-[14.5px] font-semibold text-[#8B82A8] hover:bg-white/6 lg:mt-auto"
        >
          ← {t.nav.home}
        </Link>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
