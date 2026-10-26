// Leaving a chapter goes one step UP (chapter → its story page), not one
// step back in time. Moving between chapters replaces the history entry
// (Link `replace` / router.replace), so the history reads
// "… → story → chapter" however many chapters were read; leaving then is a
// plain step back when the story page is right behind, or the story page
// put in the chapter's place when the chapter was opened from elsewhere.
// Before, leaving pushed the story page, and the phone's Back button took
// the reader straight back into the chapter.

const KEY = "hikoya:nav";
const CHAPTER_PATH = /^\/story\/([^/]+)\/[^/]+$/;

type Nav = { cur: string; prev: string | null };

function read(): Nav | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Nav | null;
  } catch {
    return null;
  }
}

// Called on every page change (BackButton is on every site page).
export function recordNav(pathname: string) {
  try {
    const nav = read();
    if (nav?.cur === pathname) return;
    const before = nav?.cur ? CHAPTER_PATH.exec(nav.cur)?.[1] : undefined;
    const now = CHAPTER_PATH.exec(pathname)?.[1];
    // Chapter → chapter of the same story replaced the entry; what's behind
    // it in the history hasn't changed.
    const prev = before && before === now ? (nav?.prev ?? null) : (nav?.cur ?? null);
    sessionStorage.setItem(KEY, JSON.stringify({ cur: pathname, prev }));
  } catch {
    // storage off — leaving falls back to opening the story page
  }
}

export function leaveToStory(router: { back: () => void; replace: (href: string) => void }, storyHref: string) {
  if (read()?.prev === storyHref) router.back();
  else router.replace(storyHref);
}
