"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { toggleSavedCollection } from "@/lib/actions/collections";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROUTES } from "@/lib/constants";

export function SaveCollectionButton({
  collectionId,
  isAuthenticated,
  initialSaved,
  path,
}: {
  collectionId: string;
  isAuthenticated: boolean;
  initialSaved: boolean;
  path: string;
}) {
  const { t } = useLocale();
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <Link
        href={ROUTES.onboarding}
        className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-[13.5px] font-bold text-ink-soft"
      >
        {t.collections.saveAction}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setSaved((v) => !v);
        startTransition(() => toggleSavedCollection(collectionId, path));
      }}
      className={clsx(
        "inline-flex h-10 cursor-pointer items-center rounded-xl border px-4 text-[13.5px] font-bold transition",
        saved ? "border-primary-300 bg-primary-50 text-primary-900" : "border-border bg-white text-ink-soft"
      )}
    >
      {saved ? t.collections.savedAction : t.collections.saveAction}
    </button>
  );
}
