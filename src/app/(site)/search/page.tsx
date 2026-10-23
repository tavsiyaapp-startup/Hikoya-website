import Link from "next/link";
import Image from "next/image";
import { GeneratedCover } from "@/components/story/GeneratedCover";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { searchStories, getCustomLanguages, type SearchFilters } from "@/lib/queries/stories";
import { localizeGenre } from "@/lib/genre";
import { languageLabel } from "@/lib/language";
import { storyProgressLabel } from "@/lib/storyProgress";
import { Chip } from "@/components/ui/Chip";
import { LinkChip } from "@/components/ui/LinkChip";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchIcon } from "@/components/ui/icons";
import { RELATIONSHIP_TYPES } from "@/lib/relationshipTypes";
import { liveImageUrl } from "@/lib/images";

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
  const pair = [...RELATIONSHIP_TYPES, ...WARNINGS, ...STYLES].find(([ru]) => ru === value);
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
    progressStatus: one(sp.progress),
    age: one(sp.age),
    relationship: one(sp.rel),
    style: one(sp.style),
    warnings: many(sp.warn),
    sort: (one(sp.sort) as SearchFilters["sort"]) ?? "popular",
  };

  const [results, customLanguages] = await Promise.all([searchStories(filters), getCustomLanguages()]);
  const hasActive = Boolean(
    filters.language ||
      filters.genre ||
      filters.progressStatus ||
      filters.age ||
      filters.relationship ||
      filters.style ||
      filters.warnings?.length
  );

  const activeCount = [
    filters.language,
    filters.genre,
    filters.progressStatus,
    filters.age,
    filters.relationship,
    filters.style,
  ].filter(Boolean).length + (filters.warnings?.length ?? 0);

  return (
    <div className="flex flex-col items-start gap-5 lg:flex-row lg:gap-7">
      {/* Phones: folded to one "Фильтры" row (with the number of active
          filters) so the results show right away; tapping it opens the
          panel — a CSS-only toggle (peer checkbox), no script needed.
          Desktop: always open in the side column, stuck below the header
          (76px) + menu bar (~61px), with its own scroll when taller than
          the screen so the last filters are reachable without scrolling
          the whole result list. */}
      <div className="w-full shrink-0 rounded-[14px] border border-border bg-card p-4.5 sm:p-5.5 lg:sticky lg:top-[150px] lg:max-h-[calc(100vh-166px)] lg:w-73 lg:overflow-y-auto lg:overscroll-contain">
        <input id="search-filters-toggle" type="checkbox" className="peer sr-only" />
        <div className="flex items-center peer-checked:mb-4.5 lg:mb-4.5 [&_.chevron]:transition peer-checked:[&_.chevron]:rotate-180">
          <label htmlFor="search-filters-toggle" className="flex flex-1 cursor-pointer items-center gap-2 lg:pointer-events-none lg:cursor-default">
            <span className="text-[17px] font-extrabold">{t.search.filters}</span>
            {activeCount > 0 && (
              <span className="flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-primary-100 px-1.5 text-[12px] font-bold text-primary-800">
                {activeCount}
              </span>
            )}
            <svg className="chevron ml-1 text-muted-2 lg:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>
          {hasActive && (
            <Link prefetch={false} href="/search" className="ml-auto text-[13px] font-semibold text-primary-800">
              {t.common.reset}
            </Link>
          )}
        </div>

        <div className="hidden peer-checked:block lg:block">
        <FilterGroup label={t.search.language} wrap>
          {["uz", "ru", ...customLanguages].map((code) => (
            <LinkChip key={code} href={buildHref(sp, { lang: filters.language === code ? undefined : code })} active={filters.language === code}>
              {languageLabel(t, code)}
            </LinkChip>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.genre} wrap>
          {t.genres.map((g) => (
            <LinkChip key={g} href={buildHref(sp, { genre: filters.genre === g ? undefined : g })} active={filters.genre === g}>
              {g}
            </LinkChip>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.relationship} wrap>
          {RELATIONSHIP_TYPES.map(([r, rUz]) => (
            <LinkChip key={r} href={buildHref(sp, { rel: filters.relationship === r ? undefined : r })} active={filters.relationship === r}>
              {locale === "uz" ? rUz : r}
            </LinkChip>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.status} wrap>
          {[
            ["ongoing", t.common.ongoing],
            ["finished", t.common.finished],
            ["dropped", t.common.dropped],
          ].map(([value, label]) => (
            <LinkChip
              key={value}
              href={buildHref(sp, { progress: filters.progressStatus === value ? undefined : value })}
              active={filters.progressStatus === value}
            >
              {label}
            </LinkChip>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.ageRating}>
          {t.ageRatings.map((age) => (
            <LinkChip key={age} href={buildHref(sp, { age: filters.age === age ? undefined : age })} active={filters.age === age}>
              {age}
            </LinkChip>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.warnings} wrap>
          {WARNINGS.map(([w, wUz]) => (
            <LinkChip key={w} href={buildHref(sp, { warn: toggleInArray(filters.warnings ?? [], w) })} active={filters.warnings?.includes(w)}>
              {locale === "uz" ? wUz : w}
            </LinkChip>
          ))}
        </FilterGroup>

        <div className="my-1 h-px bg-border-soft" />

        <FilterGroup label={t.search.style} wrap last>
          {STYLES.map(([s, sUz]) => (
            <LinkChip key={s} href={buildHref(sp, { style: filters.style === s ? undefined : s })} active={filters.style === s}>
              {locale === "uz" ? sUz : s}
            </LinkChip>
          ))}
        </FilterGroup>
        </div>
      </div>

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
              <LinkChip key={s} href={buildHref(sp, { sort: s })} active={filters.sort === s}>
                {s === "popular" ? t.search.sortPopular : s === "newest" ? t.search.sortNewest : t.search.sortViews}
              </LinkChip>
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
                ["progress", filters.progressStatus],
                ["age", filters.age],
                ["rel", filters.relationship],
                ["style", filters.style],
              ] as Array<[string, string | undefined]>
            )
              .filter(([, v]) => v)
              .map(([key, value]) => (
                <Link prefetch={false}
                  key={key}
                  href={buildHref(sp, { [key]: undefined })}
                  className="flex items-center gap-1.5 rounded-[10px] border border-primary-300 bg-primary-50 px-3 py-1.5 text-[12.5px] font-semibold text-primary-900"
                >
                  <span>
                    {key === "style" || key === "rel"
                      ? localizedLabel(value, locale)
                      : key === "progress"
                        ? storyProgressLabel(t, value as "ongoing" | "finished" | "dropped")
                        : value}
                  </span>
                  <span className="text-[14px] leading-none">×</span>
                </Link>
              ))}
            {(filters.warnings ?? []).map((w) => (
              <Link prefetch={false}
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
              <Link prefetch={false}
                key={story.id}
                href={`/story/${story.slug}`}
                className="flex gap-3.5 rounded-[14px] border border-border bg-card p-3.5 hover:border-primary-300 hover:shadow-[0_12px_28px_rgba(60,40,120,0.09)] sm:gap-5 sm:p-4.5"
              >
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[14px] bg-primary-200 sm:h-38.75 sm:w-29">
                  {liveImageUrl(story.cover_url) ? (
                    <Image
                      src={liveImageUrl(story.cover_url)!}
                      alt=""
                      fill
                      sizes="(max-width: 639px) 80px, 116px"
                      className="object-cover"
                    />
                  ) : (
                    <GeneratedCover seed={story.id} title={story.title} author={story.author?.display_name} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-[18.5px] font-extrabold tracking-tight">{story.title}</h3>
                  </div>
                  <div className="mb-2.5 text-[13.5px] text-ink-soft">
                    {story.author?.display_name} · {languageLabel(t, story.language)}
                  </div>
                  <p className="mb-3 line-clamp-2 max-w-160 text-[14px] leading-relaxed text-ink-soft">
                    {story.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {story.genres.map((g) => (
                      <Chip key={g} active className="pointer-events-none">
                        {localizeGenre(g, locale)}
                      </Chip>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-border-soft bg-card px-8 py-16 text-center">
            <div className="mb-2 text-[17px] font-bold">{t.search.noResultsTitle}</div>
            <div className="mb-4.5 text-[14px] text-muted-2">{t.search.noResultsBody}</div>
            <Link prefetch={false} href="/search">
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
