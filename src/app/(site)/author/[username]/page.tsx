import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getProfileByUsername, getAuthorStoryCount, getAuthorAchievements } from "@/lib/queries/profiles";
import { getAuthorStories } from "@/lib/queries/stories";
import { getFollowerCount, isFollowingAuthor } from "@/lib/queries/social";
import { getRequestsForAuthor } from "@/lib/queries/requests";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { StoryCard } from "@/components/story/StoryCard";
import { FollowButton } from "@/components/story/StoryActions";

const TABS = ["stories", "requests"] as const;
type Tab = (typeof TABS)[number];

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "stories";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const isOwner = user?.id === profile.id;
  const [storyCount, followerCount, following, stories, requests, achievements] = await Promise.all([
    getAuthorStoryCount(profile.id),
    getFollowerCount(profile.id),
    isFollowingAuthor(user?.id, profile.id),
    tab === "stories" ? getAuthorStories(profile.id, isOwner) : Promise.resolve([]),
    tab === "requests" ? getRequestsForAuthor(profile.id) : Promise.resolve([]),
    getAuthorAchievements(profile.id),
  ]);

  const stats = [
    { label: t.author.stories, value: storyCount },
    { label: t.author.subscribers, value: followerCount },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start gap-6.5 rounded-3xl border border-border bg-card p-7">
        <Avatar name={profile.display_name} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 text-[30px] font-extrabold tracking-tight">{profile.display_name}</h1>
          {profile.bio && <p className="mb-4 max-w-155 text-[15px] leading-relaxed text-ink-soft">{profile.bio}</p>}
          <div className="mb-4.5 flex gap-8.5">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-[21px] font-extrabold">{s.value}</div>
                <div className="text-[12.5px] text-muted-2">{s.label}</div>
              </div>
            ))}
          </div>
          {achievements.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {achievements.map((row, i) => {
                const a = row.achievement as unknown as { code: string; title_ru: string; title_uz: string } | null;
                if (!a) return null;
                return (
                  <span
                    key={i}
                    className="rounded-[11px] border border-primary-100 bg-primary-50 px-3.5 py-1.5 text-[12.5px] font-bold text-primary-900"
                  >
                    {locale === "ru" ? a.title_ru : a.title_uz}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {!isOwner && (
          <div className="w-47.5 shrink-0">
            <FollowButton
              authorId={profile.id}
              isAuthenticated={Boolean(user)}
              initialFollowing={following}
              path={ROUTES.author(username)}
            />
          </div>
        )}
      </div>

      <div className="mb-5.5 flex gap-2.5">
        {(
          [
            ["stories", t.author.tabStories],
            ["requests", t.author.tabRequests],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={`?tab=${key}`}>
            <Chip active={tab === key}>{label}</Chip>
          </Link>
        ))}
      </div>

      {tab === "stories" &&
        (stories.length > 0 ? (
          <div className="grid grid-cols-4 gap-5.5">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        ) : (
          <EmptyState text="Здесь пока нет опубликованных историй." />
        ))}

      {tab === "requests" &&
        (requests.length > 0 ? (
          <div className="flex max-w-225 flex-col gap-3.5">
            {requests.map((r) => {
              const from = r.from_user as unknown as { display_name: string } | null;
              return (
                <div key={r.id} className="rounded-[18px] border border-border bg-card px-5.5 py-5">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="text-[14px] font-bold">{from?.display_name}</span>
                  </div>
                  <p className="text-[14.5px] leading-relaxed text-ink-soft">{r.text}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Заявок пока нет." />
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
