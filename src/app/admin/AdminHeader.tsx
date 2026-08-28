"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { ROUTES } from "@/lib/constants";

export function AdminHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3.5 border-b border-border bg-card px-4 py-5.5 sm:px-8.5">
      {pathname !== ROUTES.admin && (
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface"
        >
          <ChevronLeftIcon />
        </button>
      )}
      <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">{title}</h1>
    </div>
  );
}
