// «Muqova» quote cards: the two strongest colours of a story's cover, and the
// card theme built from them. The colours are picked in the reader's browser
// (QuoteMaker draws the cover into a tiny canvas) — the server only gets the
// two colours in the card URL, so no image decoding happens on the server
// (its memory is small, see next.config.ts `unoptimized`).

type HSL = [number, number, number];

function toHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function hex(r: number, g: number, b: number) {
  return [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

// Pixels grouped into coarse buckets; each bucket scored by how many pixels
// it has and how colourful it is (near-white and near-black count for
// little). The second colour is taken from a different hue when there is one.
// `data` is RGBA (canvas getImageData). Returns two "rrggbb" strings.
export function pickCoverColors(data: ArrayLike<number>): [string, string] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += data[i];
    bucket.g += data[i + 1];
    bucket.b += data[i + 2];
    buckets.set(key, bucket);
  }
  const scored = [...buckets.values()]
    .map((b) => {
      const rgb: [number, number, number] = [b.r / b.n, b.g / b.n, b.b / b.n];
      const [h, s, l] = toHsl(...rgb);
      const lightPenalty = l < 0.12 || l > 0.9 ? 0.15 : 1;
      return { rgb, h, s, score: b.n * (0.25 + s) * lightPenalty };
    })
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return ["5b3fa0", "2a1d4f"];
  const main = scored[0];
  const second = scored.find((c) => hueDistance(c.h, main.h) > 35 && c.s > 0.15) ?? main;
  return [hex(...main.rgb), hex(...second.rgb)];
}

export const COVER_COLORS_RE = /^[0-9a-f]{6},[0-9a-f]{6}$/i;

function hsla(h: number, s: number, l: number, a = 1): string {
  return `hsla(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`;
}

function parseHex(value: string): HSL {
  const n = parseInt(value, 16);
  return toHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

// A deep background in the cover's colours with white text on top —
// readable whatever the cover looks like.
export function coverCardTheme(colors: string) {
  const [a, b] = colors.split(",");
  const main = parseHex(a);
  const second = parseHex(b);
  const sat = Math.min(0.8, Math.max(0.4, main[1] * 1.3));
  const sat2 = Math.min(0.75, Math.max(0.35, second[1] * 1.3));
  return {
    background:
      `radial-gradient(90% 60% at 15% 0%, ${hsla(main[0], sat, 0.5, 0.9)}, transparent 70%), ` +
      `radial-gradient(75% 55% at 100% 100%, ${hsla(second[0], sat2, 0.4, 0.85)}, transparent 70%), ` +
      `linear-gradient(165deg, ${hsla(main[0], sat, 0.26)}, ${hsla(second[0], sat * 0.85, 0.13)})`,
    text: "#FFFFFF",
    soft: "rgba(255,255,255,0.8)",
    accent: hsla(main[0], Math.max(0.55, sat), 0.78),
    line: "rgba(255,255,255,0.28)",
  };
}
