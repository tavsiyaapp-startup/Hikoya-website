import { notFound } from "next/navigation";
import { MangaLab } from "./MangaLab";

// Local-only prototype for the manga/comic feature. It is NOT linked anywhere
// and 404s in production, so it can only be reached with `next dev` on
// localhost — a test bed to approve the UX before touching the real story
// model / DB. Delete this folder once the feature is promoted into the real
// create/manage/reader flows.
export const metadata = { robots: { index: false, follow: false } };

export default function MangaLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MangaLab />;
}
