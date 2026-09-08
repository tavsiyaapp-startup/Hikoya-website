import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

// Google Analytics 4 Realtime API — "active users right now" (last ~30 min,
// GA4's own definition of realtime). Separate credentials from the public
// gtag.js measurement ID above: this needs a service account with Viewer
// access on the GA4 property (see .env.local for the exact env vars). Any
// missing config or API error returns null so the admin dashboard can just
// skip the widget rather than show a broken number — this is a nice-to-have,
// not load-bearing.
export async function getActiveUsersNow(): Promise<number | null> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!propertyId || !clientEmail || !privateKey) return null;

  try {
    const client = new BetaAnalyticsDataClient({ credentials: { client_email: clientEmail, private_key: privateKey } });
    const [response] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: "activeUsers" }],
    });
    const value = response.rows?.[0]?.metricValues?.[0]?.value;
    return value ? Number(value) : 0;
  } catch {
    return null;
  }
}
