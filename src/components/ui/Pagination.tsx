import Link from "next/link";
import { clsx } from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

// Windowed page list: always show first/last, current ± 1, collapse the
// rest behind a single "…" — keeps the row short even with dozens of pages.
function pageWindow(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const arrowClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border text-ink-soft transition hover:bg-surface";
  const arrowDisabledClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border-soft text-muted-3";

  return (
    <nav className={clsx("mt-5 flex items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link href={buildHref(page - 1)} scroll={false} aria-label="Previous page" className={arrowClass}>
          <ChevronLeftIcon />
        </Link>
      ) : (
        <span className={arrowDisabledClass}>
          <ChevronLeftIcon />
        </span>
      )}

      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-[13px] text-muted-3">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            scroll={false}
            className={clsx(
              "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-[10px] px-2 text-[13.5px] font-bold transition",
              p === page ? "bg-[#6D28D9] text-white" : "text-ink-soft hover:bg-surface"
            )}
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} scroll={false} aria-label="Next page" className={arrowClass}>
          <ChevronRightIcon />
        </Link>
      ) : (
        <span className={arrowDisabledClass}>
          <ChevronRightIcon />
        </span>
      )}
    </nav>
  );
}
