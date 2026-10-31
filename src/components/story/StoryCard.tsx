import Link from "next/link";
import Image from "next/image";
import { GeneratedCover } from "@/components/story/GeneratedCover";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { formatCompactCount } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { HeartIcon, EyeIcon, CommentsIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Chip";
import { storyProgressLabel } from "@/lib/storyProgress";
import type { StoryCard as StoryCardData } from "@/lib/queries/stories";
import type { StoryProgressStatus } from "@/types/database";
import { liveImageUrl } from "@/lib/images";

// Solid-color pill, distinct from the shared Badge component's softer
// pastel tones (Badge stays pastel everywhere else it's used) — this one's
// meant to read as a small graphic accent overlaid on the cover image, so
// it needs real contrast against any cover art behind it. Ongoing green is
// #15803D (not #16A34A) so white text on it clears WCAG AA (4.5:1).
const progressBadgeClasses: Record<StoryProgressStatus, string> = {
  ongoing: "bg-[#15803D] text-white",
  finished: "bg-[#7C3AED] text-white",
  dropped: "bg-[#DC2626] text-white",
};

export async function StoryCard({
  story,
  viewerIsOwner = false,
  adminHref,
  href,
  ribbonLabel,
}: {
  story: StoryCardData;
  // Only ever true from the author's own "stories" tab on their own profile
  // — everywhere else a viewer just isn't the story's author, so a
  // status !== "published" story stays a placeholder there too (see below).
  viewerIsOwner?: boolean;
  // Set only from admin-only views (e.g. the author profile at
  // /admin/users/[id]) — staff can't open a non-owner's draft/unlisted/
  // deleted story through the normal public route (getStoryBySlug blocks
  // it), so this points the card at the moderation page instead. Silent by
  // design: that route never bumps view_count or notifies the author, same
  // as every other staff moderation read on this site.
  adminHref?: string;
  // Overrides the default ROUTES.story(story.slug) target — e.g. the home
  // page's "this week" carousel links straight at the one new chapter
  // instead of the story page.
  href?: string;
  // Overrides the ongoing/finished/dropped ribbon text (keeping its same
  // pill styling/position) — e.g. "5 chapters added" instead of a status,
  // again for the "this week" carousel.
  ribbonLabel?: string;
}) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  // The story was soft-deleted (deleteStory), or an author pulled it back
  // to draft (or a moderator unlisted it) after it had already been
  // collected/bookmarked/etc — either way it's still referenced by
  // whatever list rendered this card. A non-owner has nothing left to open
  // via the public route (getStoryBySlug blocks it) — without adminHref
  // that's a dead end, just the title and a note; with it, staff still get
  // a full card, pointed at the moderation page instead.
  const isBlocked = Boolean(story.deleted_at) || (story.status !== "published" && !viewerIsOwner);
  if (isBlocked && !adminHref) {
    return (
      <div
        aria-disabled
        className="flex aspect-[3/4] flex-col items-center justify-center rounded-[14px] border border-dashed border-border-soft bg-surface p-4 text-center"
      >
        <div className="line-clamp-4 text-[14px] font-bold leading-snug text-muted-2">{story.title}</div>
        <div className="mt-2 text-[12.5px] font-semibold text-muted-3">
          {story.deleted_at ? t.story.deletedPlaceholder : t.story.unpublishedPlaceholder}
        </div>
      </div>
    );
  }

  // The cover image is the book's front face — unchanged crop/colours, just
  // the existing placeholder when there's no picture.
  // Card-sized WebP thumbnail via /thumb (src/app/thumb route) instead of the
  // full upload — /uploads is served as a static file, so a thumbnail request
  // there would be ignored; /thumb always resizes and caches for a year.
  const liveCover = liveImageUrl(story.cover_url);
  const coverSrc = liveCover?.startsWith("/uploads/")
    ? `${liveCover.replace("/uploads/", "/thumb/")}?w=360`
    : liveCover;
  const cover = coverSrc ? (
    <Image
      src={coverSrc}
      alt=""
      fill
      sizes="(max-width: 1023px) 25vw, 12.5vw"
      className="object-cover"
    />
  ) : (
    <GeneratedCover seed={story.id} title={story.title} author={story.author?.display_name} />
  );

  const showProgressMark = !ribbonLabel;

  return (
    // The card IS the book: a transparent wrapper, no border/background/
    // shadow. `book3d-link` drives the hover/focus turn (src/app/globals.css).
    <Link
      prefetch={false}
      href={isBlocked && adminHref ? adminHref : (href ?? ROUTES.story(story.slug))}
      className="book3d-link relative block text-inherit no-underline"
    >
      {/* Status — outside the 3D book, on top of it, never rotates. */}
      <span
        className={`absolute -top-2 left-[2px] z-10 inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[10.5px] font-bold shadow-[0_2px_6px_rgba(0,0,0,0.2)] ${
          ribbonLabel ? "bg-primary-600 text-white" : progressBadgeClasses[story.progress_status]
        }`}
      >
        {showProgressMark && story.progress_status === "ongoing" && <span className="book3d-dot" aria-hidden />}
        {showProgressMark && story.progress_status === "finished" && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
        <span>{ribbonLabel ?? storyProgressLabel(t, story.progress_status)}</span>
      </span>

      <div className="book3d-stage">
        <div className="book3d">
          <div className="book3d-face book3d-back" />
          <div className="book3d-pages" />
          <div className="book3d-face book3d-front">
            {cover}
            {story.deleted_at ? (
              <div className="absolute right-2 top-2">
                <Badge tone="danger">{t.admin.deletedByAuthor}</Badge>
              </div>
            ) : (
              story.status !== "published" && (
                <div className="absolute right-2 top-2">
                  <Badge tone="neutral">{story.status === "draft" ? t.common.draft : t.common.unlisted}</Badge>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Info — aligned to the book edge, no card chrome. The title always
          takes exactly two lines so author + counts line up across a row. */}
      <div className="px-[6%] pt-1">
        <h3 className="book3d-title mb-0.5 line-clamp-2 h-[2.5em] font-display text-[14px] font-bold leading-[1.25] text-[var(--book-card-title)] transition-colors">
          {story.title}
        </h3>
        <div className="mb-1.5 truncate text-[11px] text-[var(--book-card-author)]">{story.author?.display_name}</div>
        <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-[var(--book-card-stat)]">
          <span className="flex items-center gap-0.5">
            <HeartIcon width={12} height={12} filled />
            {formatCompactCount(story.like_count)}
          </span>
          <span className="flex items-center gap-0.5">
            <EyeIcon width={12} height={12} />
            {formatCompactCount(story.view_count)}
          </span>
          <span className="flex items-center gap-0.5">
            <CommentsIcon width={12} height={12} />
            {formatCompactCount(story.comment_count)}
          </span>
        </div>
      </div>
    </Link>
  );
}
