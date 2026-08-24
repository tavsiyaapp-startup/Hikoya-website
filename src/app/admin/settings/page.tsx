import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getPlatformSettingsAdmin } from "@/lib/queries/admin";
import { AdminHeader } from "../AdminHeader";
import { updatePlatformSettings } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

export default async function AdminSettingsPage() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);
  const settings = await getPlatformSettingsAdmin();

  return (
    <div>
      <AdminHeader title={t.admin.settings} />
      <div className="px-8.5 pb-15 pt-7">
        <form action={updatePlatformSettings} className="grid grid-cols-2 items-start gap-5">
          <div className="rounded-[22px] border border-border bg-card p-6.5">
            <h3 className="mb-5 text-[17px] font-extrabold">{t.admin.moderationTitle}</h3>
            <div className="flex flex-col gap-4">
              <ToggleRow
                name="commentsRequireApproval"
                title={t.admin.moderationCommentsTitle}
                desc={t.admin.moderationCommentsDesc}
                defaultChecked={settings?.comments_require_approval ?? false}
              />
              <ToggleRow
                name="newStoryRequiresReview"
                title={t.admin.moderationStoriesTitle}
                desc={t.admin.moderationStoriesDesc}
                defaultChecked={settings?.new_story_requires_review ?? false}
              />
            </div>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-6.5">
            <h3 className="mb-2 text-[17px] font-extrabold">{t.admin.guestAccessTitle}</h3>
            <p className="mb-4.5 text-[13.5px] leading-relaxed text-muted">{t.admin.guestAccessBody}</p>
            <div className="mb-6.5 flex gap-2.5">
              {[1, 2, 3, 4].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name="guestFreeChapters"
                    value={n}
                    defaultChecked={(settings?.guest_free_chapters ?? 1) === n}
                    className="peer sr-only"
                  />
                  <span className="flex h-9.5 items-center rounded-[11px] border border-border px-3.5 text-[13.5px] font-bold text-ink-soft peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:text-primary-900">
                    {n}
                  </span>
                </label>
              ))}
            </div>
            <h3 className="mb-3.5 text-[17px] font-extrabold">{t.admin.platformLanguages}</h3>
            <div className="flex gap-2.5">
              <span className="flex h-9.5 items-center rounded-[11px] bg-primary-100 px-4 text-[13.5px] font-bold text-primary-800">
                {t.languages.ru}
              </span>
              <span className="flex h-9.5 items-center rounded-[11px] bg-primary-100 px-4 text-[13.5px] font-bold text-primary-800">
                {t.languages.uz}
              </span>
            </div>
          </div>

          <div className="col-span-2">
            <Button type="submit">{t.common.save}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToggleRow({
  name,
  title,
  desc,
  defaultChecked,
}: {
  name: string;
  title: string;
  desc: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4.5 rounded-2xl border border-border-soft bg-surface px-4.5 py-4">
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block text-[14.5px] font-bold">{title}</span>
        <span className="block text-[13px] leading-relaxed text-muted-2">{desc}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 shrink-0" />
    </label>
  );
}
