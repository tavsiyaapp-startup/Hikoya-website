import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryBySlug, getChaptersForStory } from "@/lib/queries/stories";
import { getRequestsForAuthor } from "@/lib/queries/requests";
import { ROUTES } from "@/lib/constants";
import { Badge, Chip } from "@/components/ui/Chip";
import { AddChapterForm } from "@/components/manage/AddChapterForm";

const TABS = ["chapters", "stats", "requests"] as const;
type Tab = (typeof TABS)[number];

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "chapters";

  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(ROUTES.manage(slug))}`);

  const story = await getStoryBySlug(slug);
  if (!story) notFound();
  const isStaff = user.profile && ["admin", "moderator"].includes(user.profile.role);
  if (story.author.id !== user.id && !isStaff) redirect(ROUTES.home);

  const [chapters, requests] = await Promise.all([
    getChaptersForStory(story.id, true),
    tab === "requests" ? getRequestsForAuthor(story.author.id) : Promise.resolve([]),
  ]);

  const metrics = [
    { label: t.common.views, value: story.view_count },
    { label: t.common.like, value: story.like_count },
    { label: t.common.comments, value: story.comment_count },
    { label: t.story.chapters, value: chapters.length },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-6.5 rounded-3xl border border-border bg-card p-6.5">
        <div className="relative h-50 w-37.5 shrink-0 overflow-hidden rounded-2xl bg-primary-200 shadow-[0_10px_24px_rgba(60,40,120,0.16)]">
          {story.cover_url && <Image src={story.cover_url} alt="" fill className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2.5">
            <Badge tone="success">{story.status === "published" ? t.common.published : t.common.draft}</Badge>
            <Badge tone="pink">{story.genre}</Badge>
          </div>
          <h1 className="mb-4.5 text-[34px] font-extrabold tracking-tight">{story.title}</h1>
          <div className="flex gap-10">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="mb-0.5 text-[22px] font-extrabold">{m.value}</div>
                <div className="text-[12.5px] text-muted-2">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4.5 flex items-center gap-2.5">
        {(
          [
            ["chapters", t.manage.tabChapters],
            ["stats", t.manage.tabStats],
            ["requests", t.manage.tabRequests],
          ] as const
        ).map(([key, label]) => (
          <Link key={key} href={`?tab=${key}`}>
            <Chip active={tab === key}>{label}</Chip>
          </Link>
        ))}
        {tab === "chapters" && (
          <div className="ml-auto">
            <AddChapterForm storyId={story.id} storySlug={slug} />
          </div>
        )}
      </div>

      {tab === "chapters" && (
        <div className="overflow-hidden rounded-[22px] border border-border bg-card">
          {chapters.length > 0 ? (
            chapters.map((ch, i) => (
              <div
                key={ch.id}
                className={`flex items-center gap-3.5 px-5.5 py-4 ${
                  i < chapters.length - 1 ? "border-b border-border-soft" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-[15px] font-bold">{ch.title}</div>
                  <div className="text-[12.5px] text-muted-3">{ch.word_count} слов</div>
                </div>
                <div className="w-24 shrink-0 text-[14px] font-bold">{ch.view_count}</div>
                <Badge tone={ch.status === "published" ? "success" : "neutral"}>
                  {ch.status === "published" ? t.common.published : t.common.draft}
                </Badge>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-[14px] text-muted-2">
              Пока нет глав — добавьте первую.
            </div>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-[18px] border border-border bg-card px-5.5 py-4.5">
              <div className="mb-1.5 text-[13px] text-muted-2">{m.label}</div>
              <div className="text-2xl font-extrabold">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-3.5">
          {requests.length > 0 ? (
            requests.map((r) => {
              const from = r.from_user as unknown as { display_name: string } | null;
              return (
                <div key={r.id} className="rounded-[18px] border border-border bg-card px-5.5 py-5">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="text-[14px] font-bold">{from?.display_name}</span>
                    <span className="text-[12.5px] text-muted-3">
                      {new Date(r.created_at).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <p className="text-[14.5px] leading-relaxed text-ink-soft">{r.text}</p>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-6 py-10 text-center text-[14px] text-muted">
              Заявок для вас пока нет.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
