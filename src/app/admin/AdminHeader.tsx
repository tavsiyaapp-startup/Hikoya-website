"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { ROUTES } from "@/lib/constants";

export function AdminHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3.5 border-b border-border/70 bg-card/80 px-4 py-5 backdrop-blur-xl sm:px-8.5">
      {pathname !== ROUTES.admin && (
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-ink-soft hover:bg-surface"
        >
          <ChevronLeftIcon />
        </button>
      )}
      <h1 className="text-[22px] font-bold tracking-tight sm:text-[28px]">{title}</h1>
    </div>
  );
}
