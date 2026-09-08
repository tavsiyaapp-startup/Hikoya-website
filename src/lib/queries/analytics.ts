import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

// Reused across calls on a warm serverless instance instead of constructing
// (and re-authenticating) a fresh client every time — this call already runs
// once per poll from the client (see ActiveUsersNow.tsx), no need to redo
// the auth handshake with Google on every single one.
let cachedClient: BetaAnalyticsDataClient | null = null;

const TIMEOUT_MS = 5_000;

// Google Analytics 4 Realtime API — "active users right now" (last ~30 min,
// GA4's own definition of realtime). Separate credentials from the public
// gtag.js measurement ID above: this needs a service account with Viewer
// access on the GA4 property (see .env.local for the exact env vars). Any
// missing config, timeout, or API error returns null so the caller can just
// skip the widget rather than show a broken number — this is a nice-to-have,
// not load-bearing. Callers must not await this inside a page's own render —
// it's an external network call to Google and can be slow; see
// ActiveUsersNow.tsx, which fetches it client-side instead.
export async function getActiveUsersNow(): Promise<number | null> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!propertyId || !clientEmail || !privateKey) return null;

  try {
    if (!cachedClient) {
      cachedClient = new BetaAnalyticsDataClient({ credentials: { client_email: clientEmail, private_key: privateKey } });
    }
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GA4 timeout")), TIMEOUT_MS));
    const [response] = await Promise.race([
      cachedClient.runRealtimeReport({ property: `properties/${propertyId}`, metrics: [{ name: "activeUsers" }] }),
      timeout,
    ]);
    const value = response.rows?.[0]?.metricValues?.[0]?.value;
    return value ? Number(value) : 0;
  } catch {
    return null;
  }
}
