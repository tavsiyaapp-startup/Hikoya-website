import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { FORUM_CATEGORIES, isForumCategory } from "@/server/data/forum";
import { ROUTES } from "@/lib/constants";
import { NewTopicForm } from "@/components/forum/NewTopicForm";

export default async function NewTopicPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getCurrentUser();
  if (!user?.profile) redirect(ROUTES.onboarding);
  const { category } = await searchParams;
  const t = getDictionary(await getServerLocale());

  const isAdmin = user.profile.role === "admin";
  const categories = FORUM_CATEGORIES.filter((c) => c !== "elon" || isAdmin);
  const defaultCategory = isForumCategory(category) && categories.includes(category) ? category : "muhokama";

  return (
    <div className="mx-auto max-w-180">
      <Link prefetch={false} href={ROUTES.forum} className="mb-4 inline-block text-[13.5px] font-bold text-primary-800 hover:underline">
        ← {t.forum.backToList}
      </Link>
      <h1 className="mb-5 text-[24px] font-extrabold tracking-tight sm:text-[28px]">{t.forum.formTitle}</h1>
      {user.profile.status !== "active" ? (
        <p className="rounded-[12px] bg-danger-bg px-4 py-3 text-[13.5px] font-semibold text-danger">{t.forum.errBlocked}</p>
      ) : (
        <NewTopicForm categories={categories} defaultCategory={defaultCategory} />
      )}
    </div>
  );
}
