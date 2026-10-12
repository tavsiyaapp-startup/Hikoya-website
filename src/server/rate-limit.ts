import "server-only";

// Fixed-window counter kept in this process's memory. The site runs as a
// single Node process (server.js), so one in-memory map sees every request;
// counters reset on restart, which is fine for abuse limits like these.
// Not suitable as-is if the app is ever scaled to several processes.
type Window = { start: number; count: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 50_000;

function sweep(now: number) {
  for (const [key, w] of windows) {
    if (now - w.start > 24 * 60 * 60 * 1000) windows.delete(key);
  }
}

// Returns true and counts the attempt when `key` is still under `limit`
// within the current `windowMs`; returns false (without counting) once the
// limit is reached.
export function takeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (windows.size > MAX_KEYS) sweep(now);
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}
