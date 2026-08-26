"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteCollectionAdmin } from "@/lib/actions/admin";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";

export function CollectionActions({ collectionId }: { collectionId: string }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex justify-end gap-2">
      <Link
        href={`${ROUTES.admin}/collections/${collectionId}/edit`}
        className="flex h-8.5 items-center rounded-[9px] border border-primary-300 bg-white px-3 text-[12.5px] font-bold text-primary-900"
      >
        {t.admin.editAction}
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t.admin.confirmDeleteCollection)) return;
          startTransition(() => deleteCollectionAdmin(collectionId));
        }}
        className="flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-[9px] border border-red-200 bg-white text-danger disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}
