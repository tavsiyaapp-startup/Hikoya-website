import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { MessageIcon } from "@/components/ui/icons";

export async function ChatWithAdminButton({ hasUnread }: { hasUnread: boolean }) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <Link href={ROUTES.chat} className="relative block w-full">
      <Button variant="secondary" className="w-full justify-center">
        <MessageIcon width={17} height={17} />
        {t.chat.withAdmin}
      </Button>
      {hasUnread && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" />}
    </Link>
  );
}
