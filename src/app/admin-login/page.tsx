import Image from "next/image";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { AdminLoginForm } from "./AdminLoginForm";

export default async function AdminLoginPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-darker px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl bg-white/90">
          <Image src="/images/logo.png" alt="" width={32} height={32} className="object-contain" />
        </div>
        <span className="font-script text-xl text-white">{t.common.brand}</span>
      </div>
      <h1 className="text-[20px] font-extrabold text-white">{t.admin.loginTitle}</h1>
      <AdminLoginForm />
    </div>
  );
}
