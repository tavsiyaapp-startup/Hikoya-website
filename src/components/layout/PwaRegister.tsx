"use client";

import { useEffect } from "react";

// Registers public/sw.js (offline page + cache of static files) — in
// production only, so local development never serves stale code from a
// service worker cache.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.error("[pwa] service worker", err));
  }, []);
  return null;
}
