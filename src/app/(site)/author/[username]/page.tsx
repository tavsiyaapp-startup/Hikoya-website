import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getProfileByUsername, getAuthorStoryCount, getAuthorAchievements, getAuthorTotals } from "@/lib/queries/profiles";
import { getAuthorStories, getCollectionsFeaturingAuthor } from "@/lib/queries/stories";
import { getFollowerCount, isFollowingAuthor } from "@/lib/queries/social";
import { getRequestsBySubmitter } from "@/lib/queries/requests";
import { requestStatusTone, requestStatusLabel } from "@/lib/requestStatus";
import { getNotifications } from "@/lib/queries/notifications";
import { ROUTES } from "@/lib/constants";
import { formatCompactCount } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { LinkChip } from "@/components/ui/LinkChip";
import { StoryCard } from "@/components/story/StoryCard";
import { FollowButton } from "@/components/story/StoryActions";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import { NotificationList } from "@/components/notifications/NotificationList";
import { CloseRequestButton } from "@/components/board/CloseRequestButton";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { VerifiedIcon, SparkleIcon } from "@/components/ui/icons";

const TABS = ["stories", "collections", "myRequests", "notifications"] as const;
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
  const [storyCount, followerCount, following, stories, myRequests, achievements, notifications, totals, featuringCollections] =
    await Promise.all([
      getAuthorStoryCount(profile.id),
      getFollowerCount(profile.id),
      isFollowingAuthor(user?.id, profile.id),
      tab === "stories" ? getAuthorStories(profile.id, isOwner) : Promise.resolve([]),
      isOwner && tab === "myRequests" ? getRequestsBySubmitter(profile.id) : Promise.resolve([]),
      getAuthorAchievements(profile.id),
      isOwner && tab === "notifications" ? getNotifications(profile.id) : Promise.resolve([]),
      getAuthorTotals(profile.id),
      tab === "collections" ? getCollectionsFeaturingAuthor(profile.id) : Promise.resolve([]),
    ]);

  const stats = [
    { label: t.author.stories, value: storyCount },
    { label: t.author.subscribers, value: followerCount },
    { label: t.author.totalLikes, value: formatCompactCount(totals.totalLikes) },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-5 rounded-3xl border border-border bg-card p-4.5 sm:flex-row sm:gap-6.5 sm:p-7">
        <Avatar name={profile.display_name} src={profile.avatar_url} size={80} className="sm:!h-24 sm:!w-24" />
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 flex items-center gap-2 text-[24px] font-extrabold tracking-tight sm:text-[30px]">
            {profile.display_name}
            {profile.is_verified && (
              <VerifiedIcon className="shrink-0 text-primary-600" aria-label={t.author.verified} />
            )}
          </h1>
          {profile.bio && <p className="mb-4 max-w-155 text-[15px] leading-relaxed text-ink-soft">{profile.bio}</p>}
          <div className="mb-4.5 flex flex-wrap gap-6 sm:gap-8.5">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-[21px] font-extrabold">{s.value}</div>
                <div className="text-[12.5px] text-muted-2">{s.label}</div>
              </div>
            ))}
          </div>
          {(profile.is_verified || achievements.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {profile.is_verified && (
                <span className="flex items-center gap-1.5 rounded-[11px] border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-[12.5px] font-bold text-primary-900">
                  <VerifiedIcon className="shrink-0" />
                  {t.author.verified}
                </span>
              )}
              {achievements.map((row, i) => {
                const a = row.achievement as unknown as { code: string; title_ru: string; title_uz: string } | null;
                if (!a) return null;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-[11px] border border-primary-100 bg-primary-50 px-3.5 py-1.5 text-[12.5px] font-bold text-primary-900"
                  >
                    <SparkleIcon className="shrink-0 text-primary-500" />
                    {locale === "ru" ? a.title_ru : a.title_uz}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {!isOwner && (
          <div className="w-full shrink-0 sm:w-47.5">
            <FollowButton
              authorId={profile.id}
              isAuthenticated={Boolean(user)}
              initialFollowing={following}
              path={ROUTES.author(username)}
            />
          </div>
        )}
      </div>

      {isOwner && (
        <div className="mb-6">
          <EditProfileForm
            userId={profile.id}
            username={profile.username}
            displayName={profile.display_name}
            avatarUrl={profile.avatar_url}
            email={user?.email ?? null}
            bio={profile.bio}
          />
        </div>
      )}

      <div className="mb-5.5 flex gap-2.5 overflow-x-auto">
        {(
          [
            ["stories", t.author.tabStories],
            ["collections", t.author.tabCollections],
            ...(isOwner ? [["myRequests", t.author.tabMyRequests] as const] : []),
            ...(isOwner ? [["notifications", t.nav.notifications] as const] : []),
          ] as const
        ).map(([key, label]) => (
          <LinkChip key={key} href={`?tab=${key}`} active={tab === key} shrink>
            {label}
          </LinkChip>
        ))}
      </div>

      {tab === "notifications" && isOwner && (
        <NotificationList notifications={notifications} locale={locale} />
      )}

      {tab === "stories" &&
        (stories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5.5 lg:grid-cols-4">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        ) : (
          <EmptyState text={t.author.noStoriesYet} />
        ))}

      {tab === "collections" &&
        (featuringCollections.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5.5 lg:grid-cols-3">
            {featuringCollections.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        ) : (
          <EmptyState text={t.author.noCollectionsYet} />
        ))}

      {tab === "myRequests" && isOwner &&
        (myRequests.length > 0 ? (
          <div className="flex max-w-225 flex-col gap-3.5">
            {myRequests.map((r) => {
              const responseCount = (r.responses as unknown as unknown[] | null)?.length ?? 0;
              return (
                <div key={r.id} className="rounded-[18px] border border-border bg-card px-5.5 py-5">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <Badge tone={requestStatusTone(r.status)}>{requestStatusLabel(t, r.status)}</Badge>
                    <span className="text-[12.5px] text-muted-2">
                      {responseCount} {t.board.responsesCountSuffix}
                    </span>
                    {r.status !== "closed" && <CloseRequestButton requestId={r.id} />}
                  </div>
                  <Link
                    href={`${ROUTES.board}?selected=${r.id}`}
                    className="mb-1.5 block text-[15px] font-extrabold leading-snug hover:text-primary-800"
                  >
                    {r.title}
                  </Link>
                  <p className="line-clamp-2 text-[14.5px] leading-relaxed text-ink-soft">{r.text}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text={t.board.noRequestsYet} />
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
