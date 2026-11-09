"use client";

// Seasonal decoration — a light autumn "falling leaves" layer, home page only.
// A full-screen fixed canvas drawn by the `falling-leaves` package (no runtime
// dependencies). Clicks pass through it (pointer-events: none), it is
// aria-hidden, and it pauses itself for anyone whose system asks for reduced
// motion (respectReducedMotion defaults to true).
//
// zIndex 5 keeps the leaves above the page background and content but BELOW the
// sticky header (z-50), dropdowns, modals and toasts (z-[100]+), so they only
// ever drift over the browsing content, never the chrome.
//
// count/opacity are kept modest on purpose: this site runs on a small box
// (3 cores / 4 GB) and is mostly read on phones, so the effect stays cheap.
import { FallingLeaves } from "falling-leaves/react";

export function FallingLeavesLayer() {
  return (
    <FallingLeaves
      fullScreen
      count={18}
      opacity={0.5}
      zIndex={5}
      shapes={["maple", "oak", "ginkgo"]}
    />
  );
}
