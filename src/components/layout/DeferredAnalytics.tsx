"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

// Booting Google Analytics costs ~130ms of main-thread time (measured in a
// PageSpeed trace: "Google Tag Manager — 126 ms", plus a forced reflow from
// gtag). Left on Next's default `afterInteractive` it runs during hydration
// and inflated both Total Blocking Time and the LCP render-delay on the home
// page. Mount it only once the page has gone idle (or the reader scrolls/taps/
// types), so it never competes with the first paint. A page-view still fires —
// just a beat later — for every visit that lasts more than a moment, which is
// every real reading session; only an instant bounce (< ~2s, no interaction)
// goes uncounted.
export function DeferredAnalytics({ gaId }: { gaId: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let fired = false;
    let idleHandle = 0;
    let timeoutHandle = 0;

    const go = () => {
      if (fired) return;
      fired = true;
      setReady(true);
    };

    // Whichever comes first: the browser goes idle (capped at 2.5s), or the
    // reader interacts with the page. requestIdleCallback is typed as always
    // present but isn't on every engine (older Safari), so treat it as optional
    // and fall back to a plain timeout.
    const ric = window.requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    if (ric) {
      idleHandle = ric(go, { timeout: 2500 });
    } else {
      timeoutHandle = window.setTimeout(go, 2000);
    }
    const opts = { once: true, passive: true } as const;
    window.addEventListener("scroll", go, opts);
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("keydown", go, { once: true });

    return () => {
      if (idleHandle) window.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
      window.removeEventListener("scroll", go);
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  return ready ? <GoogleAnalytics gaId={gaId} /> : null;
}
