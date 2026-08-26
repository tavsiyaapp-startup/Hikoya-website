"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { clsx } from "clsx";
import { Chip } from "@/components/ui/Chip";

// A Link-wrapped Chip used everywhere the site has tab/filter switchers
// (?tab=, ?status=, search filters, ...). Clicking one of these re-renders
// a server component, which can take a moment — without this, the click
// gave zero feedback until the new page arrived, reading as "did that even
// register?". useLinkStatus() dims the specific chip the instant it's
// clicked, independent of whatever the route's loading.tsx does.
export function LinkChip({
  href,
  active,
  children,
  scroll,
  shrink,
  className,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  scroll?: boolean;
  shrink?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} scroll={scroll} className={clsx("inline-flex", shrink && "shrink-0")}>
      <PendingChip active={active} className={className}>
        {children}
      </PendingChip>
    </Link>
  );
}

function PendingChip({
  active,
  children,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <Chip active={active} className={clsx("whitespace-nowrap transition-opacity", pending && "opacity-50", className)}>
      {children}
    </Chip>
  );
}
