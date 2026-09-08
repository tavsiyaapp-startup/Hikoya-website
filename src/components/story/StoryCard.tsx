import Link from "next/link";
import Image from "next/image";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { formatCompactCount } from "@/lib/format";
import { ROUTES } from "@/lib/constants";
import { HeartIcon, EyeIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Chip";
import { storyProgressLabel } from "@/lib/storyProgress";
import type { StoryCard as StoryCardData } from "@/lib/queries/stories";
import type { StoryProgressStatus } from "@/types/database";

// Solid-color pill, distinct from the shared Badge component's softer
// pastel tones (Badge stays pastel everywhere else it's used) — this one's
// meant to read as a small graphic accent overlaid on the cover image, so
// it needs real contrast against any cover art behind it.
const progressBadgeClasses: Record<StoryProgressStatus, string> = {
  ongoing: "bg-[#16A34A] text-white",
  finished: "bg-[#7C3AED] text-white",
  dropped: "bg-[#DC2626] text-white",
};

export async function StoryCard({
  story,
  viewerIsOwner = false,
}: {
  story: StoryCardData;
  // Only ever true from the author's own "stories" tab on their own profile
  // — everywhere else a viewer just isn't the story's author, so a
  // status !== "published" story stays a placeholder there too (see below).
  viewerIsOwner?: boolean;
}) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  // The story was soft-deleted (deleteStory), or an author pulled it back
  // to draft (or a moderator unlisted it) after it had already been
  // collected/bookmarked/etc — either way it's still referenced by
  // whatever list rendered this card, but a non-owner has nothing left to
  // open (getStoryBySlug blocks it), so no link: just the title and a note.
  if (story.deleted_at || (story.status !== "published" && !viewerIsOwner)) {
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

  return (
    <div className="relative">
      <span
        className={`absolute -left-1 -top-3.5 z-10 inline-flex items-center rounded-[8px] px-2 py-1 text-[10.5px] font-bold shadow-[0_2px_6px_rgba(0,0,0,0.2)] ${progressBadgeClasses[story.progress_status]}`}
      >
        {storyProgressLabel(t, story.progress_status)}
      </span>
      <Link
        href={ROUTES.story(story.slug)}
        className="block overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(60,40,120,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(60,40,120,0.12)]"
      >
        <div className="relative flex aspect-[3/4] items-center justify-center bg-primary-200 p-3">
          {story.cover_url ? (
            <Image
              src={story.cover_url}
              alt=""
              fill
              sizes="(max-width: 1023px) 25vw, 12.5vw"
              className="object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="line-clamp-4 text-[12.5px] font-extrabold leading-snug text-primary-900">
                {story.title}
              </div>
              <div className="mt-1.5 truncate text-[10.5px] font-semibold text-primary-800/80">
                {story.author?.display_name}
              </div>
            </div>
          )}
          {story.status !== "published" && (
            <div className="absolute right-2 top-2">
              <Badge tone="neutral">{story.status === "draft" ? t.common.draft : t.common.unlisted}</Badge>
            </div>
          )}
        </div>
        <div className="p-2.5">
          <h3 className="mb-0.5 line-clamp-2 min-h-8 text-[12.5px] font-bold leading-tight">
            {story.title}
          </h3>
          <div className="mb-1.5 truncate text-[11px] text-muted-2">{story.author?.display_name}</div>
          <div className="flex items-center gap-2.5 text-[11px] font-semibold text-muted-3">
            <span className="flex items-center gap-1">
              <HeartIcon width={12} height={12} filled />
              {formatCompactCount(story.like_count)}
            </span>
            <span className="flex items-center gap-1">
              <EyeIcon width={12} height={12} />
              {formatCompactCount(story.view_count)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
