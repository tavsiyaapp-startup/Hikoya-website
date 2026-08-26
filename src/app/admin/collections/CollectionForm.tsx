import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getAllStoriesForAdminPicker } from "@/lib/queries/admin";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export async function CollectionForm({
  action,
  initialTitle = "",
  initialDescription = "",
  initialFeatured = false,
  initialCheckedIds = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialTitle?: string;
  initialDescription?: string;
  initialFeatured?: boolean;
  initialCheckedIds?: string[];
}) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const stories = await getAllStoriesForAdminPicker();
  const checkedSet = new Set(initialCheckedIds);

  return (
    <form action={action} className="max-w-190">
      <Input
        name="title"
        defaultValue={initialTitle}
        placeholder={t.collections.createTitlePlaceholder}
        required
        className="mb-3.5"
      />
      <Textarea
        name="description"
        defaultValue={initialDescription}
        placeholder={t.collections.createDescPlaceholder}
        rows={3}
        className="mb-4"
      />
      <label className="mb-5 flex items-center gap-2 text-[13.5px] text-ink-soft">
        <input type="checkbox" name="isFeatured" defaultChecked={initialFeatured} className="h-4 w-4" />
        {t.admin.featuredLabel}
      </label>

      <label className="mb-2 block text-[14px] font-bold">{t.admin.selectStories}</label>
      <div className="mb-5 max-h-96 overflow-y-auto rounded-2xl border border-border p-2">
        {stories.length > 0 ? (
          stories.map((s) => {
            const author = s.author as unknown as { display_name: string } | null;
            return (
              <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-surface">
                <input
                  type="checkbox"
                  name="storyIds"
                  value={s.id}
                  defaultChecked={checkedSet.has(s.id)}
                  className="h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{s.title}</span>
                <span className="shrink-0 text-[12px] text-muted-2">{author?.display_name}</span>
              </label>
            );
          })
        ) : (
          <p className="px-2.5 py-2 text-[13px] text-muted-2">{t.admin.emptyGeneric}</p>
        )}
      </div>

      <Button type="submit">{t.common.save}</Button>
    </form>
  );
}
