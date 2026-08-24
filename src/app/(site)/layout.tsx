import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { getCurrentUser } from "@/lib/current-user";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-bg">
      <Header user={user} />
      <div className="flex items-start">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 px-9 pb-18 pt-7">{children}</main>
      </div>
    </div>
  );
}
