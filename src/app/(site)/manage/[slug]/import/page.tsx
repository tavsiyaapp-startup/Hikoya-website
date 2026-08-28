import { notFound, redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { getStoryBySlug } from "@/lib/queries/stories";
import { ROUTES } from "@/lib/constants";
import { ImportWizard } from "./ImportWizard";
import { ImportGuide } from "./ImportGuide";

export default async function ImportChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.onboarding}?next=${encodeURIComponent(`${ROUTES.manage(slug)}/import`)}`);

  const story = await getStoryBySlug(slug);
  if (!story) notFound();
  if (story.author.id !== user.id) redirect(ROUTES.home);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-extrabold tracking-tight sm:text-[28px]">{t.manage.importDocument}</h1>
        <ImportGuide />
      </div>
      <p className="mb-6.5 text-[14.5px] text-muted">{story.title}</p>
      <ImportWizard storyId={story.id} storySlug={slug} />
    </div>
  );
}
