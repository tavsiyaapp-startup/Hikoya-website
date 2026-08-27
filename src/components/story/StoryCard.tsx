import Link from "next/link";
import Image from "next/image";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { localizeGenre } from "@/lib/genre";
import { ROUTES } from "@/lib/constants";
import { HeartIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Chip";
import type { StoryCard as StoryCardData } from "@/lib/queries/stories";

export async function StoryCard({ story }: { story: StoryCardData }) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <Link
      href={ROUTES.story(story.slug)}
      className="group block overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_2px_10px_rgba(60,40,120,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(60,40,120,0.12)]"
    >
      <div className="relative flex aspect-[3/4] items-center justify-center bg-primary-200 p-4">
        {story.cover_url ? (
          <Image src={story.cover_url} alt="" fill className="object-cover" />
        ) : (
          <div className="text-center">
            <div className="line-clamp-4 text-[15px] font-extrabold leading-snug text-primary-900">
              {story.title}
            </div>
            <div className="mt-2 truncate text-[12.5px] font-semibold text-primary-800/80">
              {story.author?.display_name}
            </div>
          </div>
        )}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 text-[12.5px] font-bold text-white backdrop-blur-sm">
          <HeartIcon filled />
          <span>{story.like_count}</span>
        </div>
        {story.status !== "published" && (
          <div className="absolute right-3 top-3">
            <Badge tone="neutral">{story.status === "draft" ? t.common.draft : t.common.unlisted}</Badge>
          </div>
        )}
      </div>
      <div className="p-4 pb-4">
        <h3 className="mb-1 line-clamp-2 min-h-10 text-[15.5px] font-bold leading-tight">
          {story.title}
        </h3>
        <div className="mb-2.5 truncate text-[13px] text-muted-2">{story.author?.display_name}</div>
        <Badge tone="pink">{localizeGenre(story.genre, locale)}</Badge>
      </div>
    </Link>
  );
}
