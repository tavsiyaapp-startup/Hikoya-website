import Link from "next/link";
import Image from "next/image";
import { getServerLocale } from "@/lib/i18n/locale-server";
import { getDictionary } from "@/lib/i18n";
import { ROUTES } from "@/lib/constants";
import { Badge } from "@/components/ui/Chip";
import { CollectionsIcon } from "@/components/ui/icons";
import type { CollectionCardData } from "@/lib/queries/stories";

const STACK_POSITIONS: Record<number, string[]> = {
  1: ["left-1/2 top-1 -translate-x-1/2"],
  2: ["left-[30%] top-2 -translate-x-1/2 -rotate-6", "left-[70%] top-0 -translate-x-1/2 rotate-6"],
  3: [
    "left-[18%] top-2.5 -translate-x-1/2 -rotate-8",
    "left-1/2 top-0 -translate-x-1/2",
    "left-[82%] top-2.5 -translate-x-1/2 rotate-8",
  ],
};

export async function CollectionCard({ collection }: { collection: CollectionCardData }) {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  const ownerLabel =
    collection.owner_type === "moderator" ? t.collections.hikoyaTeam : collection.owner?.display_name;

  return (
    <Link
      href={ROUTES.collection(collection.id)}
      className="rounded-[22px] border border-border bg-card p-5 hover:border-primary-300 hover:shadow-[0_14px_30px_rgba(60,40,120,0.1)]"
    >
      <CollectionCoverStack coverUrls={collection.coverUrls} />

      <div className="mb-2 flex items-center gap-2">
        {collection.owner_type === "moderator" && <Badge tone="pink">{t.collections.editorial}</Badge>}
        {collection.is_private && <Badge tone="neutral">{t.collections.private}</Badge>}
      </div>
      <h3 className="mb-1.5 text-[17px] font-extrabold">{collection.title}</h3>
      <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted">{collection.description}</p>
      <div className="mt-3 text-[12.5px] text-muted-2">
        {collection.storyCount} {t.collections.storiesCountSuffix}
        {ownerLabel && <> &nbsp;•&nbsp; {ownerLabel}</>}
      </div>
    </Link>
  );
}

function CollectionCoverStack({ coverUrls }: { coverUrls: string[] }) {
  if (coverUrls.length === 0) {
    return (
      <div className="relative mb-4 flex h-32 items-center justify-center rounded-[16px] bg-linear-to-br from-primary-100 to-pink-bg">
        <CollectionsIcon className="text-primary-400" />
      </div>
    );
  }

  const positions = STACK_POSITIONS[coverUrls.length] ?? STACK_POSITIONS[3];

  return (
    <div className="relative mb-4 h-32">
      {coverUrls.map((url, i) => (
        <div
          key={url + i}
          className={`absolute h-28 w-21 overflow-hidden rounded-[10px] border-2 border-white shadow-[0_8px_18px_rgba(60,40,120,0.18)] ${positions[i]}`}
        >
          <Image src={url} alt="" fill className="object-cover" />
        </div>
      ))}
    </div>
  );
}
