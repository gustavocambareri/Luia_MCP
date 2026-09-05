// Luia visual language.
//
// Paper ground, ink strokes, no colour. The instrument on the right is drawn
// with depth as tone: near strokes are ink, far strokes fade toward FAINT, which
// is what gives the body its dimension without any shading.
export const PAPER = [214, 214, 212] as const;
export const INK = [22, 22, 22] as const;
export const FAINT = [140, 140, 138] as const;
/** Chalk: the one value lighter than the ground. Reserved for live connections. */
export const CHALK = [250, 250, 249] as const;

export const EASE = "cubic-bezier(.2,.8,.2,1)";
export const DUR = 600;

export const rgb = (c: readonly number[], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const mix = (a: readonly number[], b: readonly number[], t: number) =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as const;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// The house easing, solved for y given x. Used for anything that is animated
// frame by frame on the canvas rather than by CSS.
export function bez(t: number): number {
  t = clamp(t, 0, 1);
  const cx = 0.6, bx = -cx, ax = 1 - cx - bx;
  const cy = 2.4, by = 3 * (1 - 0.8) - cy, ay = 1 - cy - by;
  let lo = 0, hi = 1, s = t;
  for (let i = 0; i < 18; i++) {
    s = (lo + hi) / 2;
    const x = ((ax * s + bx) * s + cx) * s;
    if (x < t) lo = s; else hi = s;
  }
  return ((ay * s + by) * s + cy) * s;
}

// Depth to tone: z runs -1 (back) to 1 (front).
export const toneFor = (z: number) => mix(FAINT, INK, clamp((z + 1) / 2, 0, 1));

/** The only colour in the app. Used as a flag, never as a fill. */
export const YELLOW = [214, 178, 32] as const;

export const SANS = "'ABC Schengen',system-ui,sans-serif";
// One family throughout. Machine text differs by size and tracking, not typeface.
export const MONO = SANS;

// Titles are stored uppercase; the manifest reads better in title case.
export const titleCase = (s: string) =>
  s.toLowerCase()
    .replace(/(^|[\s\-—(/])([a-z])/g, (_m, a, b) => a + b.toUpperCase())
    .replace(/\bUx\b/g, "UX").replace(/\bUi\b/g, "UI")
    .replace(/\bVs\b/g, "vs").replace(/\bAnd\b/g, "and").replace(/\bFrom\b/g, "from");
