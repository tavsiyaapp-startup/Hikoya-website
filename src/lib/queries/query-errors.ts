import "server-only";

// Shared by every read in src/lib/queries/*. Reads return an empty value on
// failure so a page still renders its empty state, but the failure is now
// logged with the query name. Before, ~80 catch blocks swallowed errors with
// no trace, so a dead database or a broken query looked like "no stories".
export function logQueryError(name: string, err: unknown): void {
  console.error(`query ${name} failed:`, err);
}

// For unstable_cache'd reads: the cached function itself must throw on
// failure (unstable_cache only stores successful results), otherwise an empty
// fallback produced during a database hiccup would be cached and served to
// everyone for the whole revalidate window. This wrapper catches outside the
// cache and returns the fallback for that one request only.
export function withFallback<A extends unknown[], R>(
  name: string,
  cached: (...args: A) => Promise<R>,
  fallback: () => R
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await cached(...args);
    } catch (err) {
      logQueryError(name, err);
      return fallback();
    }
  };
}
