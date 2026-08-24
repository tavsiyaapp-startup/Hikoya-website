import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavProvider } from "@/components/layout/MobileNavContext";
import { getCurrentUser } from "@/lib/current-user";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-bg">
        <Header user={user} />
        <div className="flex items-start">
          <Sidebar user={user} />
          <main className="min-w-0 flex-1 px-4 pb-14 pt-5 sm:px-6 lg:px-9 lg:pb-18 lg:pt-7">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
