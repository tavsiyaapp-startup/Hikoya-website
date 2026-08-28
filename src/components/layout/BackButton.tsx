"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { ROUTES } from "@/lib/constants";

// Literal "go back to whatever page you were just on" (browser history),
// not a fixed parent route — a story/chapter/author/collection page can be
// reached from a dozen different places (home, search, a genre link, a
// collection, another author's profile...), so there's no single correct
// "up" link to hardcode. Hidden on the home page itself (nothing to go back
// to), on /create (its own step wizard chrome), and on the chapter reader
// (/story/[slug]/[chapter] already has a "← {story title}" link back to
// the story, more useful than a generic one since it's unambiguous).
const HIDDEN_PATHS = new Set<string>([ROUTES.home, ROUTES.create]);
const CHAPTER_READER_PATH = /^\/story\/[^/]+\/[^/]+$/;

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  if (HIDDEN_PATHS.has(pathname) || CHAPTER_READER_PATH.test(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-4 flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold text-muted-2 transition hover:text-ink-soft"
    >
      <ChevronLeftIcon width={16} height={16} />
      {t.common.back}
    </button>
  );
}
