import { clsx } from "clsx";

// A book cover drawn for a story that has no picture (most stories, and
// every one whose image was on the old Supabase storage): one of a few
// calm, dark palettes — always the same one for the same story — a thin
// frame like a printed cover, the title in the book serif and the author
// below. Sizes come from the container's own width (cqi), so one component
// fits a 118px card and a 300px story-page cover alike.
const PALETTES = [
  { from: "#3E2A6B", to: "#5B3A8E", glow: "#A68BE0" }, // plum
  { from: "#12343B", to: "#1F5C63", glow: "#7FC8C2" }, // night teal
  { from: "#5A2440", to: "#8A3A5E", glow: "#F2A7C3" }, // rose
  { from: "#1E2559", to: "#34408F", glow: "#8EA2F0" }, // indigo
  { from: "#4E3112", to: "#835522", glow: "#F0C27F" }, // ochre
  { from: "#1F3A2C", to: "#2F5A43", glow: "#9CD3A7" }, // forest
  { from: "#4A1C2A", to: "#73303F", glow: "#E89AA6" }, // wine
  { from: "#26303D", to: "#3E4B5C", glow: "#AFC0D4" }, // slate
] as const;

export function coverPalette(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

export function GeneratedCover({
  seed,
  title,
  author,
  className,
}: {
  // Story id (stable), so a story keeps its colour when renamed.
  seed: string;
  title: string;
  author?: string | null;
  className?: string;
}) {
  const p = coverPalette(seed);
  return (
    <div
      aria-hidden
      className={clsx("@container absolute inset-0 overflow-hidden text-white", className)}
      style={{
        background: `radial-gradient(120% 80% at 15% 0%, ${p.glow}55, transparent 60%), linear-gradient(160deg, ${p.to}, ${p.from})`,
      }}
    >
      {/* Spine shadow on the left edge, as on a real book. */}
      <div className="absolute inset-y-0 left-0 w-[6%] bg-linear-to-r from-black/25 to-transparent" />
      {/* Printed frame. */}
      <div className="absolute inset-[6%] rounded-[3cqi] border border-white/25" />
      <div className="absolute inset-[6%] flex flex-col items-center justify-between px-[7%] py-[11%] text-center">
        <span className="h-px w-[22%] bg-white/50" />
        <span
          className="line-clamp-5 font-display font-semibold leading-[1.12] tracking-[-0.01em] text-balance [overflow-wrap:anywhere]"
          style={{ fontSize: "clamp(11px, 11.5cqi, 34px)" }}
        >
          {title}
        </span>
        <span
          className="line-clamp-1 max-w-full font-semibold uppercase tracking-[0.14em] text-white/75"
          style={{ fontSize: "clamp(7.5px, 5cqi, 13px)" }}
        >
          {author ?? ""}
        </span>
      </div>
    </div>
  );
}
