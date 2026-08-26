import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { searchStories, type SearchFilters } from "@/lib/queries/stories";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchIcon } from "@/components/ui/icons";

type Query = { [key: string]: string | string[] | undefined };

// Value sent in the URL / matched against tags.label_ru in the DB is always
// the Russian label (tuple[0]) — only the on-screen text switches with locale.
const WARNINGS: [string, string][] = [
  ["Нецензурная лексика", "Soʻkinish soʻzlari"],
  ["Насилие", "Zoʻravonlik"],
  ["Упоминание смерти", "Oʻlim haqida eslatma"],
  ["Триггерные темы", "Trigger mavzular"],
];
const STYLES: [string, string][] = [
  ["Ангст", "Angst"],
  ["Флафф", "Flaff"],
  ["Юмор", "Yumor"],
  ["Экшн", "Ekshn"],
  ["Хёрт/комфорт", "Hyort/komfort"],
];

function localizedLabel(value: string | undefined, locale: "ru" | "uz"): string | undefined {
  if (!value || locale === "ru") return value;
  const pair = [...WARNINGS, ...STYLES].find(([ru]) => ru === value);
  return pair ? pair[1] : value;
}

function buildHref(current: Query, patch: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

function toggleInArray(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const sp = await searchParams;
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

  const filters: SearchFilters = {
    q: one(sp.q),
    language: one(sp.lang),
    genre: one(sp.genre),
    status: one(sp.status),
    age: one(sp.age),
    style: one(sp.style),
    warnings: many(sp.warn),
    sort: (one(sp.sort) as SearchFilters["sort"]) ?? "popular",
  };

  const results = await searchStories(filters);
  const hasActive = Boolean(
    filters.language || filters.genre || filters.status || filters.age || filters.style || filters.warnings?.length
  );

  return (
    <div className="flex flex-col items-start gap-5 lg:flex-row lg:gap-7">
      <details
        open
        className="w-full shrink-0 rounded-[22px] border border-border bg-card p-5.5 lg:sticky lg:top-26 lg:w-73"
      >
        <summary className="mb-4.5 flex cursor-pointer list-none items-center marker:hidden lg:pointer-events-none lg:cursor-default [&::-webkit-details-marker]:hidden">
          <span className="text-[17px] font-extrabold">{t.search.filters}</span>
          <Link href="/search" className="ml-auto text-[13px] font-semibold text-primary-800 lg:pointer-events-auto">
            {t.common.reset}
          </Link>
        </summary>

        <FilterGroup label={t.search.language}>
          {["ru", "uz"].map((code) => (
            <Link key={code} href={buildHref(sp, { lang: filters.language === code ? undefined : code })}>
              <Chip active={filters.language === code}>{t.languages[code as "ru" | "uz"]}</Chip>
            </Link>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.genre} wrap>
          {t.genres.map((g) => (
            <Link key={g} href={buildHref(sp, { genre: filters.genre === g ? undefined : g })}>
              <Chip active={filters.genre === g}>{g}</Chip>
            </Link>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.status}>
          {[
            ["published", t.common.ongoing],
            ["unlisted", t.common.finished],
          ].map(([value, label]) => (
            <Link key={value} href={buildHref(sp, { status: filters.status === value ? undefined : value })}>
              <Chip active={filters.status === value}>{label}</Chip>
            </Link>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.ageRating}>
          {t.ageRatings.map((age) => (
            <Link key={age} href={buildHref(sp, { age: filters.age === age ? undefined : age })}>
              <Chip active={filters.age === age}>{age}</Chip>
            </Link>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.warnings} wrap>
          {WARNINGS.map(([w, wUz]) => (
            <Link key={w} href={buildHref(sp, { warn: toggleInArray(filters.warnings ?? [], w) })}>
              <Chip active={filters.warnings?.includes(w)}>{locale === "uz" ? wUz : w}</Chip>
            </Link>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.style} wrap last>
          {STYLES.map(([s, sUz]) => (
            <Link key={s} href={buildHref(sp, { style: filters.style === s ? undefined : s })}>
              <Chip active={filters.style === s}>{locale === "uz" ? sUz : s}</Chip>
            </Link>
          ))}
        </FilterGroup>
      </details>

      <div className="min-w-0 w-full flex-1">
        <div className="mb-5 flex flex-wrap items-center gap-3.5">
          <h1 className="text-2xl font-extrabold tracking-tight">{t.search.title}</h1>
          <span className="text-[14px] text-muted-2">{results.length}</span>
          <form action="/search" className="order-3 flex w-full gap-1.5 sm:order-none sm:ml-auto sm:w-auto">
            {Object.entries(sp)
              .filter(([k]) => k !== "q")
              .flatMap(([k, v]) =>
                (Array.isArray(v) ? v : [v]).filter(Boolean).map((val, i) => (
                  <input key={`${k}-${i}`} type="hidden" name={k} value={val as string} />
                ))
              )}
            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute left-3 top-2.5 text-muted-3" />
              <Input
                name="q"
                defaultValue={filters.q}
                placeholder={t.common.searchPlaceholder}
                className="h-9 w-full rounded-[10px] pl-9 text-[13px]"
              />
            </div>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {(["popular", "newest", "views"] as const).map((s) => (
              <Link key={s} href={buildHref(sp, { sort: s })}>
                <Chip active={filters.sort === s}>
                  {s === "popular" ? t.search.sortPopular : s === "newest" ? t.search.sortNewest : t.search.sortViews}
                </Chip>
              </Link>
            ))}
          </div>
        </div>

        {hasActive && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-2">{t.search.active}</span>
            {(
              [
                ["lang", filters.language],
                ["genre", filters.genre],
                ["status", filters.status],
                ["age", filters.age],
                ["style", filters.style],
              ] as Array<[string, string | undefined]>
            )
              .filter(([, v]) => v)
              .map(([key, value]) => (
                <Link
                  key={key}
                  href={buildHref(sp, { [key]: undefined })}
                  className="flex items-center gap-1.5 rounded-[10px] border border-primary-300 bg-primary-50 px-3 py-1.5 text-[12.5px] font-semibold text-primary-900"
                >
                  <span>{key === "style" ? localizedLabel(value, locale) : value}</span>
                  <span className="text-[14px] leading-none">×</span>
                </Link>
              ))}
            {(filters.warnings ?? []).map((w) => (
              <Link
                key={`warn-${w}`}
                href={buildHref(sp, { warn: toggleInArray(filters.warnings ?? [], w) })}
                className="flex items-center gap-1.5 rounded-[10px] border border-primary-300 bg-primary-50 px-3 py-1.5 text-[12.5px] font-semibold text-primary-900"
              >
                <span>{localizedLabel(w, locale)}</span>
                <span className="text-[14px] leading-none">×</span>
              </Link>
            ))}
          </div>
        )}

        {results.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {results.map((story) => (
              <Link
                key={story.id}
                href={`/story/${story.slug}`}
                className="flex gap-3.5 rounded-[20px] border border-border bg-card p-3.5 hover:border-primary-300 hover:shadow-[0_12px_28px_rgba(60,40,120,0.09)] sm:gap-5 sm:p-4.5"
              >
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-[14px] bg-primary-200 sm:h-38.75 sm:w-29" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-[18.5px] font-extrabold tracking-tight">{story.title}</h3>
                  </div>
                  <div className="mb-2.5 text-[13.5px] text-ink-soft">
                    {story.author?.display_name} · {t.languages[story.language]}
                  </div>
                  <p className="mb-3 line-clamp-2 max-w-160 text-[14px] leading-relaxed text-ink-soft">
                    {story.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Chip active className="pointer-events-none">
                      {story.genre}
                    </Chip>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-border-soft bg-card px-8 py-16 text-center">
            <div className="mb-2 text-[17px] font-bold">{t.search.noResultsTitle}</div>
            <div className="mb-4.5 text-[14px] text-muted-2">{t.search.noResultsBody}</div>
            <Link href="/search">
              <Button>{t.search.resetFilters}</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
  wrap,
  last,
}: {
  label: string;
  children: React.ReactNode;
  wrap?: boolean;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-muted-2">{label}</div>
      <div className={wrap ? "flex flex-wrap gap-1.5" : "flex gap-1.5"}>{children}</div>
    </div>
  );
}
