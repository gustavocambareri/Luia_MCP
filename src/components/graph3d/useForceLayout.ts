import { useMemo } from "react";
import type { GraphNode } from "../../lib/types";

export interface NodePosition3D {
  x: number;
  y: number;
  z: number;
  angle: number;
}

export function nodeRadius(fileSize: number): number {
  const min = 300;
  const max = 15000;
  const clamped = Math.max(min, Math.min(max, fileSize));
  const t = (clamped - min) / (max - min);
  return 3 + t * 4;
}

// Hand-placed positions for an organic, radial composition.
const MANUAL_POSITIONS: Record<string, { x: number; y: number }> = {
  // ── Team (center cluster) ──
  "_team/convictions":            { x: -20,  y: 30 },
  "_team/design-system-patterns": { x: 35,   y: 60 },
  "_team/workflows":              { x: 10,   y: -20 },

  // ── Museon (upper-left) ──
  "projects/museon/ux-architecture":                     { x: -240, y: 180 },
  "projects/museon/mobile-ux-patterns":                  { x: -160, y: 130 },
  "projects/museon/collection-editorial-hybrid-redesign": { x: -280, y: 90 },
  "projects/museon/desktop-to-mobile":                   { x: -190, y: 40 },

  // ── Pulse (right) ──
  "projects/pulse/design-system":                   { x: 220, y: 120 },
  "projects/pulse/scroll-features-reference":       { x: 290, y: 50 },
  "projects/pulse/implementation-plan":             { x: 200, y: -10 },
  "projects/pulse/figma-frame-vs-component-mcp":    { x: 280, y: -60 },

  // ── Solara (bottom) ──
  "projects/solara/new-structure":          { x: -60,  y: -140 },
  "projects/solara/extraction":             { x: 40,   y: -170 },
  "projects/solara/sitemap":                { x: -120, y: -210 },
  "projects/solara/implementdesign":        { x: 50,   y: -240 },
  "projects/solara/sitemap-update-workflow": { x: -40,  y: -290 },
};

export function useForceLayout(nodes: GraphNode[]): {
  positions: Map<string, NodePosition3D>;
} {
  return useMemo(() => {
    const positions = new Map<string, NodePosition3D>();

    for (const node of nodes) {
      const manual = MANUAL_POSITIONS[node.id];
      if (manual) {
        positions.set(node.id, {
          x: manual.x,
          y: manual.y,
          z: 0,
          angle: Math.atan2(manual.y, manual.x),
        });
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = 200 + Math.random() * 80;
        positions.set(node.id, {
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          z: 0,
          angle: a,
        });
      }
    }

    return { positions };
  }, [nodes]);
}
