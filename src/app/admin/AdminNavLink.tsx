"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export function AdminNavLink({
  href,
  label,
  badge,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        "flex h-11.5 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 text-[14.5px] font-semibold transition",
        active ? "bg-white/12 text-white" : "text-[#B7AFD1] hover:bg-white/6"
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">{children}</span>
      <span>{label}</span>
      {Boolean(badge) && (
        <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
