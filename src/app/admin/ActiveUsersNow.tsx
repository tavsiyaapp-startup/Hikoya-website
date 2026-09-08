"use client";

import { useEffect, useState } from "react";
import { fetchActiveUsersNow } from "@/lib/actions/analytics";

const POLL_MS = 30_000;

// Fetches entirely client-side, on its own, rather than being awaited as
// part of the /admin page's own server render — this GA4 Realtime API call
// hits Google over the network and can be slow (or hang) independently of
// our own database, and blocking the whole dashboard's SSR on it made every
// admin page load feel slow. Renders nothing until the first fetch resolves
// (and stays hidden if GA4 isn't configured, i.e. the fetch keeps resolving
// null), so the rest of the dashboard is never held up by it.
export function ActiveUsersNow({ label }: { label: string }) {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const v = await fetchActiveUsersNow();
      if (!cancelled && v !== null) setValue(v);
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (value === null) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-[20px] border border-border bg-card px-6 py-4">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
      </span>
      <span className="text-[14px] text-muted-2">{label}</span>
      <span className="text-[20px] font-extrabold tracking-tight">{value}</span>
    </div>
  );
}
