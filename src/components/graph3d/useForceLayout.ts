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
// Team sits at the centre; the six engagements fan out around it.
const MANUAL_POSITIONS: Record<string, { x: number; y: number }> = {
  // ── Team (center cluster) ──
  "_team/convictions":            { x: -20,  y: 30 },
  "_team/design-system-patterns": { x: 35,   y: 60 },
  "_team/workflows":              { x: 10,   y: -20 },

  // ── Meridian (upper-left) ──
  "projects/meridian/ux-architecture":        { x: -300, y: 210 },
  "projects/meridian/mobile-patterns":        { x: -205, y: 165 },
  "projects/meridian/archive-block-redesign": { x: -340, y: 120 },
  "projects/meridian/desktop-to-mobile":      { x: -235, y: 70 },

  // ── Lumen (right) ──
  "projects/lumen/design-system":       { x: 250, y: 165 },
  "projects/lumen/scroll-reference":    { x: 330, y: 95 },
  "projects/lumen/implementation-plan": { x: 240, y: 35 },
  "projects/lumen/extraction-notes":    { x: 325, y: -25 },

  // ── Atlas (lower-right) ──
  "projects/atlas/sitemap":               { x: 195, y: -125 },
  "projects/atlas/block-library":         { x: 290, y: -175 },
  "projects/atlas/implement-from-design": { x: 165, y: -215 },
  "projects/atlas/sync-workflow":         { x: 265, y: -270 },

  // ── Cadence (bottom) ──
  "projects/cadence/motion-language":   { x: -40, y: -180 },
  "projects/cadence/component-states":  { x: 40,  y: -245 },
  "projects/cadence/interaction-audit": { x: -70, y: -300 },

  // ── Harbor (lower-left) ──
  "projects/harbor/research-synthesis":       { x: -235, y: -110 },
  "projects/harbor/information-architecture": { x: -320, y: -170 },
  "projects/harbor/usability-testing":        { x: -215, y: -240 },

  // ── Verso (upper-right) ──
  "projects/verso/brand-expression":    { x: 120, y: 235 },
  "projects/verso/editorial-grid":      { x: 215, y: 285 },
  "projects/verso/art-direction-notes": { x: 60,  y: 300 },
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
