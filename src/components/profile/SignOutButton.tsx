"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const { t } = useLocale();

  return (
    <form
      action="/auth/signout"
      method="POST"
      onSubmit={(e) => {
        if (!window.confirm(t.profile.confirmSignOut)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="danger" size="sm">
        {t.profile.signOut}
      </Button>
    </form>
  );
}
