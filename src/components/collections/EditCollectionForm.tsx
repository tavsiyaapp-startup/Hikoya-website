"use client";

import { useState, useTransition } from "react";
import { updateCollection } from "@/lib/actions/collections";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import type { Collection } from "@/types/database";

export function EditCollectionForm({ collection }: { collection: Collection }) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mb-7 cursor-pointer text-[13px] font-bold text-primary-800"
      >
        {t.collections.editCollection}
      </button>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await updateCollection(collection.id, formData);
          setEditing(false);
        })
      }
      className="mb-7 rounded-3xl border border-border bg-card p-4.5 sm:p-6.5"
    >
      <Input name="title" defaultValue={collection.title} required className="mb-3.5" />
      <Textarea name="description" defaultValue={collection.description ?? ""} rows={2} className="mb-3.5" />
      <label className="mb-4 flex items-center gap-2 text-[13.5px] text-ink-soft">
        <input type="checkbox" name="isPrivate" defaultChecked={collection.is_private} className="h-4 w-4" />
        {t.collections.private}
      </label>
      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.loading : t.common.save}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}
