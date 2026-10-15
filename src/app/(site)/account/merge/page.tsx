import Link from "next/link";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/current-user";
import { ROUTES } from "@/lib/constants";
import { describeMerge, readMergeToken } from "@/server/auth/telegram-merge";
import { Button } from "@/components/ui/Button";
import { MergeConfirmButton } from "./MergeConfirmButton";

// Landing page of the "join accounts" link mailed to a taken email address
// (src/server/auth/config.ts). Joins nothing by itself — it explains what
// will happen and only works for the Telegram account that asked.
export default async function MergeAccountsPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const t = getDictionary(await getServerLocale());
  const [user, request] = await Promise.all([getCurrentUser(), readMergeToken(token)]);
  const target = request ? await describeMerge(request) : null;
  const here = `/account/merge?token=${encodeURIComponent(token)}`;

  let body: React.ReactNode;
  if (!request || !target) {
    body = <p className="text-[14.5px] leading-relaxed text-ink-soft">{t.merge.invalid}</p>;
  } else if (!user) {
    body = (
      <>
        <p className="mb-5 text-[14.5px] leading-relaxed text-ink-soft">{t.merge.signInFirst}</p>
        <Link prefetch={false} href={`${ROUTES.login}?next=${encodeURIComponent(here)}`}>
          <Button>{t.common.login}</Button>
        </Link>
      </>
    );
  } else if (user.id !== request.telegramUserId) {
    body = <p className="text-[14.5px] leading-relaxed text-ink-soft">{t.merge.wrongAccount}</p>;
  } else {
    body = (
      <>
        <p className="mb-3 text-[14.5px] leading-relaxed text-ink-soft">
          {t.merge.explain.replace("{name}", target.display_name).replace("{username}", target.username)}
        </p>
        <p className="mb-6 text-[13px] leading-relaxed text-muted-2">{t.merge.whatMoves}</p>
        <MergeConfirmButton token={token} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-140 rounded-[16px] border border-border bg-card p-6 sm:p-8">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight">{t.merge.title}</h1>
      {body}
    </div>
  );
}
