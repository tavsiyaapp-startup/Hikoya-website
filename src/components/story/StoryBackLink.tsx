"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { leaveToStory } from "@/lib/reader-nav";

// «‹ Story title» above a chapter: up to the story page, as a step back in
// history when that's where the reader came from (src/lib/reader-nav.ts).
// A real link (href) so it still opens in a new tab or without JS.
export function StoryBackLink({ href, title }: { href: string; title: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        leaveToStory(router, href);
      }}
      className="mb-5 inline-flex items-center gap-2 text-[14px] font-semibold"
    >
      <ChevronLeftIcon />
      <span>{title}</span>
    </a>
  );
}
