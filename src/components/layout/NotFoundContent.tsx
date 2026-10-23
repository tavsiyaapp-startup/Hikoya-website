import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

// "Page not found": a torn-out page instead of a bare 404. Shared by the
// site's own not-found (inside the header/footer layout) and the root one
// for addresses that match no route at all.
export function NotFoundContent({ t }: { t: Dictionary }) {
  return (
    <div className="mx-auto flex max-w-140 flex-col items-center py-14 text-center sm:py-20">
      <div className="relative mb-8 h-40 w-32">
        <div className="absolute inset-0 rotate-[-7deg] rounded-[14px] bg-primary-200/70" />
        <div className="absolute inset-0 flex rotate-[4deg] flex-col items-center justify-center rounded-[14px] border border-border bg-card shadow-[0_24px_50px_-24px_rgba(45,31,85,0.5)]">
          <span className="font-display text-[44px] font-bold leading-none text-primary-700">404</span>
          <span className="mt-3 h-px w-12 bg-primary-300" />
          <span className="mt-2 h-px w-16 bg-primary-200" />
          <span className="mt-2 h-px w-10 bg-primary-200" />
        </div>
      </div>
      <h1 className="mb-3 text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">{t.notFound.title}</h1>
      <p className="mb-8 text-[15.5px] leading-relaxed text-muted">{t.notFound.body}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link prefetch={false} href={ROUTES.home}>
          <Button>{t.notFound.home}</Button>
        </Link>
        <Link prefetch={false} href={ROUTES.search}>
          <Button variant="ghost">{t.notFound.search}</Button>
        </Link>
      </div>
    </div>
  );
}
