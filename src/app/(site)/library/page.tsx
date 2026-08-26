import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import {
  getContinueReading,
  getBookmarkedStories,
  getStoriesByReadingStatus,
} from "@/lib/queries/stories";
import { getFollowedAuthorsWithStories } from "@/lib/queries/social";
import { ROUTES } from "@/lib/constants";
import { StoryCard } from "@/components/story/StoryCard";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";

const TABS = ["reading", "wantToRead", "read", "dropped", "bookmarks", "following"] as const;
type Tab = (typeof TABS)[number];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "reading";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.library)}`);

  const [reading, wantToRead, read, dropped, bookmarks, following] = await Promise.all([
    tab === "reading" ? getContinueReading(user.id, 20) : Promise.resolve([]),
    tab === "wantToRead" ? getStoriesByReadingStatus(user.id, "want_to_read") : Promise.resolve([]),
    tab === "read" ? getStoriesByReadingStatus(user.id, "read") : Promise.resolve([]),
    tab === "dropped" ? getStoriesByReadingStatus(user.id, "dropped") : Promise.resolve([]),
    tab === "bookmarks" ? getBookmarkedStories(user.id) : Promise.resolve([]),
    tab === "following" ? getFollowedAuthorsWithStories(user.id) : Promise.resolve([]),
  ]);

  const gridTab =
    tab === "wantToRead"
      ? { items: wantToRead, empty: t.library.noWantToReadYet }
      : tab === "read"
        ? { items: read, empty: t.library.noReadYet }
        : tab === "dropped"
          ? { items: dropped, empty: t.library.noDroppedYet }
          : tab === "bookmarks"
            ? { items: bookmarks, empty: t.library.noBookmarksYet }
            : null;

  return (
    <div>
      <h1 className="mb-5.5 text-[26px] font-extrabold tracking-tight sm:text-[32px]">{t.library.title}</h1>
      <div className="mb-6.5 flex gap-2.5 overflow-x-auto">
        {(
          [
            ["reading", t.library.tabReading],
            ["wantToRead", t.library.tabWantToRead],
            ["read", t.library.tabRead],
            ["dropped", t.library.tabDropped],
            ["bookmarks", t.library.tabBookmarks],
            ["following", t.library.tabFollowing],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={`?tab=${key}`}>
            <Chip active={tab === key}>{label}</Chip>
          </Link>
        ))}
      </div>

      {tab === "reading" &&
        (reading.length > 0 ? (
          <div className="flex max-w-225 flex-col gap-3.5">
            {reading.map((item, i) => {
              const story = item.story as unknown as {
                id: string;
                title: string;
                slug: string;
                cover_url: string | null;
              } | null;
              if (!story) return null;
              return (
                <Link
                  key={i}
                  href={ROUTES.story(story.slug)}
                  className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-3.5 hover:border-primary-300 sm:gap-4.5 sm:p-4.5"
                >
                  <div className="relative h-20 w-15 shrink-0 overflow-hidden rounded-[13px] bg-primary-200 sm:h-25 sm:w-19">
                    {story.cover_url && <Image src={story.cover_url} alt="" fill className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-2.5 line-clamp-2 text-[15px] font-extrabold sm:text-[17px]">{story.title}</h3>
                    <div className="h-2 max-w-115 overflow-hidden rounded-full bg-border-soft">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-primary-700 to-primary-500"
                        style={{ width: `${Math.min(100, Math.round(item.percent))}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-14 shrink-0 text-right sm:w-22">
                    <div className="text-[15px] font-extrabold sm:text-xl">{Math.round(item.percent)}%</div>
                    <div className="hidden text-[12.5px] text-muted-2 sm:block">{t.library.percentRead}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState text={t.library.notStartedReading} />
        ))}

      {gridTab &&
        (gridTab.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
            {gridTab.items.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        ) : (
          <EmptyState text={gridTab.empty} />
        ))}

      {tab === "following" &&
        (following.length > 0 ? (
          <div className="flex flex-col gap-9">
            {following.map((group) => (
              <div key={group.author.id}>
                <Link
                  href={ROUTES.author(group.author.username)}
                  className="mb-3.5 flex items-center gap-2.5"
                >
                  <Avatar name={group.author.display_name} src={group.author.avatar_url} size={36} />
                  <h2 className="text-[17px] font-extrabold">{group.author.display_name}</h2>
                </Link>
                {group.stories.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
                    {group.stories.map((story) => (
                      <StoryCard key={story.id} story={story} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[13.5px] text-muted-2">{t.library.authorNoStoriesYet}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text={t.library.noFollowingYet} />
        ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
      {text}
    </div>
  );
}
