import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getProfileById, getAuthorStoryCount, getAuthorTotals } from "@/lib/queries/profiles";
import { getAuthorStories, getCollectionsFeaturingAuthor } from "@/lib/queries/stories";
import { getFollowerCount } from "@/lib/queries/social";
import { getAllAchievements, getUserAchievementsMap } from "@/lib/queries/admin";
import { ROUTES } from "@/lib/constants";
import { formatCompactCount } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Chip";
import { LinkChip } from "@/components/ui/LinkChip";
import { Button } from "@/components/ui/Button";
import { StoryCard } from "@/components/story/StoryCard";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { VerifiedIcon, SparkleIcon, MessageIcon } from "@/components/ui/icons";
import { AdminHeader } from "../../AdminHeader";
import { UserStatusButton } from "../UserStatusButton";
import { AdminBadgesPanel } from "./AdminBadgesPanel";

const TABS = ["stories", "collections"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminUserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "stories";

  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const profile = await getProfileById(id);
  if (!profile) notFound();

  const [storyCount, followerCount, stories, totals, featuringCollections, achievements, achievementsMap] = await Promise.all([
    getAuthorStoryCount(profile.id),
    getFollowerCount(profile.id),
    // true = include drafts/unpublished — staff can see everything an
    // author sees on their own profile, not just what's public.
    tab === "stories" ? getAuthorStories(profile.id, true) : Promise.resolve([]),
    getAuthorTotals(profile.id),
    tab === "collections" ? getCollectionsFeaturingAuthor(profile.id) : Promise.resolve([]),
    getAllAchievements(),
    getUserAchievementsMap([profile.id]),
  ]);

  const checkedAchievementIds = achievementsMap.get(profile.id) ?? [];
  const earnedAchievements = achievements.filter((a) => checkedAchievementIds.includes(a.id));

  const stats = [
    { label: t.author.stories, value: storyCount },
    { label: t.author.subscribers, value: followerCount },
    { label: t.author.totalLikes, value: formatCompactCount(totals.totalLikes) },
  ];

  return (
    <div>
      <AdminHeader title={profile.display_name} />
      <div className="px-4 pb-15 pt-7 sm:px-8.5">
        <div className="mb-6 flex flex-col items-start gap-5 rounded-[16px] border border-border bg-card p-4.5 sm:flex-row sm:gap-6.5 sm:p-7">
          <Avatar name={profile.display_name} src={profile.avatar_url} size={80} className="sm:!h-24 sm:!w-24" />
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 flex items-center gap-2 text-[24px] font-extrabold tracking-tight sm:text-[30px]">
              {profile.display_name}
              {profile.is_verified && (
                <VerifiedIcon className="shrink-0 text-primary-600" aria-label={t.author.verified} />
              )}
            </h1>
            <div className="mb-2.5 text-[13.5px] text-muted-2">@{profile.username}</div>
            {profile.bio && <p className="mb-4 max-w-155 text-[15px] leading-relaxed text-ink-soft">{profile.bio}</p>}
            <div className="mb-4.5 flex flex-wrap gap-6 sm:gap-8.5">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-[21px] font-extrabold">{s.value}</div>
                  <div className="text-[12.5px] text-muted-2">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={profile.status === "active" ? "success" : "danger"}>{profile.status}</Badge>
              {profile.is_verified && (
                <span className="flex items-center gap-1.5 rounded-[11px] border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-[12.5px] font-bold text-primary-900">
                  <VerifiedIcon className="shrink-0" />
                  {t.author.verified}
                </span>
              )}
              {earnedAchievements.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-[11px] border border-primary-100 bg-primary-50 px-3.5 py-1.5 text-[12.5px] font-bold text-primary-900"
                >
                  <SparkleIcon className="shrink-0 text-primary-500" />
                  {locale === "ru" ? a.title_ru : a.title_uz}
                </span>
              ))}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-47.5">
            <Link href={ROUTES.adminChats(profile.id)}>
              <Button variant="secondary" className="w-full justify-center">
                <MessageIcon width={16} height={16} />
                {t.admin.writeMessage}
              </Button>
            </Link>
            <UserStatusButton userId={profile.id} status={profile.status} className="h-[46px] w-full justify-center rounded-[13px] text-[14.5px]" />
          </div>
        </div>

        <AdminBadgesPanel
          userId={profile.id}
          achievements={achievements}
          initialCheckedIds={checkedAchievementIds}
          locale={locale}
        />

        <div className="mb-5.5 flex gap-2.5 overflow-x-auto">
          {TABS.map((key) => (
            <LinkChip key={key} href={`?tab=${key}`} active={tab === key} shrink>
              {key === "stories" ? t.author.tabStories : t.author.tabCollections}
            </LinkChip>
          ))}
        </div>

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
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-border-soft bg-surface px-6 py-14 text-center text-[14px] text-muted">
      {text}
    </div>
  );
}
