import { notFound } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getProfileByUsername, getAuthorStoryCount, getAuthorAchievements, getAuthorTotals } from "@/lib/queries/profiles";
import { getAuthorStories, getCollectionsFeaturingAuthor } from "@/lib/queries/stories";
import { getFollowerCount, isFollowingAuthor } from "@/lib/queries/social";
import { getDb } from "@/server/db/client";
import { listForumPostsByAuthor } from "@/server/data/forum";
import { getDonation } from "@/server/data/donations";
import { logQueryError } from "@/lib/queries/query-errors";
import { getNotifications } from "@/lib/queries/notifications";
import { getAdminChatSummary } from "@/lib/queries/chat";
import { ROUTES } from "@/lib/constants";
import { formatCompactCount } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { LinkChip } from "@/components/ui/LinkChip";
import { StoryCard } from "@/components/story/StoryCard";
import { FollowButton } from "@/components/story/StoryActions";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import { NotificationList } from "@/components/notifications/NotificationList";
import { PostCard } from "@/components/forum/PostCard";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { ChatWithAdminButton } from "@/components/chat/ChatWithAdminButton";
import { DonateButton } from "@/components/profile/DonateButton";
import { DonationSettings } from "@/components/profile/DonationSettings";
import { SubscribeButton } from "@/components/paywall/SubscribeButton";
import { getMySubscriptionExpiry, getPaywallState, paywallOffer } from "@/lib/queries/paywall";
import { formatDateTime } from "@/lib/format";
import { VerifiedIcon, SparkleIcon, InstagramIcon, SendIcon } from "@/components/ui/icons";
import { plural } from "@/lib/plural";

const TABS = ["stories", "collections", "myTopics", "notifications"] as const;
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
  const [storyCount, followerCount, following, stories, myTopics, achievements, notifications, totals, featuringCollections, chatSummary, donation] =
    await Promise.all([
      getAuthorStoryCount(profile.id),
      getFollowerCount(profile.id),
      isFollowingAuthor(user?.id, profile.id),
      tab === "stories" ? getAuthorStories(profile.id, isOwner) : Promise.resolve([]),
      isOwner && tab === "myTopics"
        ? Promise.resolve().then(() => listForumPostsByAuthor(getDb(), null, profile.id)).catch((err) => {
            logQueryError("listForumPostsByAuthor", err);
            return [];
          })
        : Promise.resolve([]),
      getAuthorAchievements(profile.id),
      isOwner && tab === "notifications" ? getNotifications(profile.id) : Promise.resolve([]),
      getAuthorTotals(profile.id),
      tab === "collections" ? getCollectionsFeaturingAuthor(profile.id) : Promise.resolve([]),
      isOwner ? getAdminChatSummary(profile.id) : Promise.resolve(null),
      // Before D:/QIZLAB/backups/author_donations.sql is run the table is
      // missing: no button, no error page.
      Promise.resolve().then(() => getDonation(getDb(), profile.id)).catch((err) => {
        logQueryError("getDonation", err);
        return undefined;
      }),
    ]);

  // «Donat»: settings only for an author with a published story; the
  // button once a card is filled in (and never on a blocked account).
  const canHaveDonations = storyCount > 0 && profile.status === "active" && donation !== undefined;
  const showDonate = canHaveDonations && donation != null;

  // «Obuna» on the owner's own profile: until when, or a button to subscribe.
  const [paywall, subscriptionExpiry] = isOwner
    ? await Promise.all([getPaywallState(), getMySubscriptionExpiry(profile.id)])
    : [null, null];
  const subscriptionActive = Boolean(subscriptionExpiry && subscriptionExpiry > new Date());

  const stats = [
    { label: plural(storyCount, t.author.stories), value: storyCount },
    { label: plural(followerCount, t.author.subscribers), value: followerCount },
    { label: plural(totals.totalLikes, t.author.totalLikes), value: formatCompactCount(totals.totalLikes) },
  ];

  return (
    <div>
      <div className="mb-7 overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_24px_50px_-34px_rgba(45,31,85,0.45)]">
      {/* Wide header band, the same brand violet for every author (fixed
          values, not the theme's mirrored primary scale, so it reads the
          same in light and dark mode). */}
      <div
        aria-hidden
        className="h-28 sm:h-36"
        style={{
          background: "radial-gradient(70% 140% at 15% 0%, #B19EE2, transparent 65%), radial-gradient(50% 120% at 100% 100%, rgba(194,46,124,0.35), transparent 70%), linear-gradient(120deg, #5535A6, #2D1F55)",
        }}
      />
      <div className="flex flex-col items-start gap-5 px-4.5 pb-6 sm:flex-row sm:gap-6.5 sm:px-8 sm:pb-8">
        <Avatar
          name={profile.display_name}
          src={profile.avatar_url}
          size={88}
          className="-mt-11 ring-4 ring-card sm:!-mt-14 sm:!h-28 sm:!w-28"
        />
        <div className="min-w-0 flex-1 sm:pt-4">
          <h1 className="mb-2 flex items-center gap-2 text-[26px] font-bold leading-tight tracking-tight sm:text-[34px]">
            {profile.display_name}
            {profile.is_verified && (
              <VerifiedIcon className="shrink-0 text-primary-600" aria-label={t.author.verified} />
            )}
          </h1>
          {profile.bio && <p className="mb-4 max-w-155 text-[15px] leading-relaxed text-ink-soft">{profile.bio}</p>}
          {(profile.instagram_handle || profile.telegram_handle) && (
            <div className="mb-4.5 flex items-center gap-2.5">
              {profile.instagram_handle && (
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Instagram: @${profile.instagram_handle}`}
                  className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-border bg-surface text-ink-soft transition hover:border-primary-300 hover:text-primary-800"
                >
                  <InstagramIcon width={17} height={17} />
                </a>
              )}
              {profile.telegram_handle && (
                <a
                  href={`https://t.me/${profile.telegram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Telegram: @${profile.telegram_handle}`}
                  className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-border bg-surface text-ink-soft transition hover:border-primary-300 hover:text-primary-800"
                >
                  <SendIcon width={17} height={17} />
                </a>
              )}
            </div>
          )}
          <div className="mb-4.5 flex flex-wrap gap-6 sm:gap-8.5">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-[24px] font-bold tabular-nums">{s.value}</div>
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
        <div className="w-full shrink-0 sm:w-47.5 sm:pt-4">
          {showDonate && donation && (
            <div className="mb-2.5">
              <DonateButton
                authorId={profile.id}
                authorName={profile.display_name}
                avatarUrl={profile.avatar_url}
                local={donation.local}
                intl={donation.intl}
                cardHolder={donation.cardHolder}
                message={donation.message}
              />
            </div>
          )}
          {isOwner && subscriptionActive && subscriptionExpiry && (
            <p className="mb-2.5 rounded-xl bg-primary-50 px-3 py-2 text-center text-[12.5px] font-bold text-primary-900">
              {t.paywall.activeUntil.replace("{date}", formatDateTime(subscriptionExpiry.toISOString(), locale))}
            </p>
          )}
          {isOwner && !subscriptionActive && paywall?.live && (
            <div className="mb-2.5">
              <SubscribeButton offer={paywallOffer(paywall.settings, locale)} nextPath={ROUTES.author(username)} />
            </div>
          )}
          {isOwner ? (
            <ChatWithAdminButton hasUnread={chatSummary?.unread_by_user ?? false} />
          ) : (
            <FollowButton
              authorId={profile.id}
              isAuthenticated={Boolean(user)}
              initialFollowing={following}
              path={ROUTES.author(username)}
            />
          )}
        </div>
      </div>
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
            instagramHandle={profile.instagram_handle}
            telegramHandle={profile.telegram_handle}
            telegramLinked={user?.profile?.telegram_id != null}
            donationSettings={
              canHaveDonations ? (
                <DonationSettings
                  username={profile.username}
                  local={donation?.local ?? null}
                  intl={donation?.intl ?? null}
                  cardHolder={donation?.cardHolder ?? null}
                  message={donation?.message ?? null}
                />
              ) : undefined
            }
          />
        </div>
      )}

      <div className="mb-5.5 flex gap-2.5 overflow-x-auto">
        {(
          [
            ["stories", t.author.tabStories],
            ["collections", t.author.tabCollections],
            ...(isOwner ? [["myTopics", t.author.tabMyTopics] as const] : []),
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
              <StoryCard key={s.id} story={s} viewerIsOwner={isOwner} />
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

      {tab === "myTopics" && isOwner &&
        (myTopics.length > 0 ? (
          <div className="flex max-w-225 flex-col gap-3">
            {myTopics.map((post) => (
              <PostCard key={post.id} post={post} t={t} locale={locale} voteState="own" />
            ))}
          </div>
        ) : (
          <EmptyState text={t.forum.myTopicsEmpty} />
        ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state rounded-[18px] border border-dashed border-border bg-card/60 px-6 py-14 text-center text-[14px] text-muted">
      {text}
    </div>
  );
}
