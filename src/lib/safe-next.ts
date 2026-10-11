// `next` comes from the URL (?next=...) or a form field, so it's attacker-
// controlled. Passing it straight to redirect()/router.push() made the login
// pages an open redirect: /login?next=https://evil.example would send a user
// who just signed in to a phishing page that looks like it came from us.
// Only same-site paths are allowed; anything else falls back to the home page.
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
