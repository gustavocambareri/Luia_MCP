import { useMemo } from "react";
import { Vector3 } from "three";
import type { GraphNode } from "../../lib/types";

export interface NodePosition3D {
  x: number;
  y: number;
  z: number;
  angle: number;
}

export interface GroupArc3D {
  key: string;
  startAngle: number;
  endAngle: number;
  color: string;
}

const GROUP_ORDER = ["team", "meridian", "lumen", "atlas", "cadence", "harbor", "verso"];
const GAP_FRACTION = 0.045;
const RING_RADIUS = 180;

const GROUP_COLORS: Record<string, string> = {
  team: "#2E4052",
  meridian: "#BF5F49",
  lumen: "#B8862F",
  atlas: "#5E8F64",
  cadence: "#8C5C74",
  harbor: "#5A7E96",
  verso: "#A2674F",
};

// Subtle Z offsets per group so they separate slightly in 3D
const GROUP_Z: Record<string, number> = {
  team: 0,
  meridian: 10,
  lumen: 5,
  atlas: -5,
  cadence: -10,
  harbor: 8,
  verso: -8,
};

export const GROUP_LABELS: Record<string, string> = {
  team: "Team Knowledge",
  meridian: "Meridian",
  lumen: "Lumen",
  atlas: "Atlas",
  cadence: "Cadence",
  harbor: "Harbor",
  verso: "Verso",
};

function getGroupKey(node: GraphNode): string {
  if (node.scope === "team") return "team";
  return node.project ?? node.scope;
}

export { RING_RADIUS, GROUP_COLORS };

export function useRingLayout(nodes: GraphNode[]): {
  positions: Map<string, NodePosition3D>;
  groupArcs: GroupArc3D[];
} {
  return useMemo(() => {
    if (nodes.length === 0) return { positions: new Map(), groupArcs: [] };

    const groups = new Map<string, GraphNode[]>();
    for (const key of GROUP_ORDER) groups.set(key, []);

    for (const node of nodes) {
      const key = getGroupKey(node);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(node);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => a.name.localeCompare(b.name));
    }

    const activeGroups = GROUP_ORDER.filter(k => (groups.get(k)?.length ?? 0) > 0);
    const N = nodes.length;
    const numGaps = activeGroups.length;
    const halfGap = (GAP_FRACTION * Math.PI) / 2;
    const totalGapRadians = numGaps * GAP_FRACTION * 2 * Math.PI;
    const nodeArcRadians = (2 * Math.PI - totalGapRadians) / N;

    const positions = new Map<string, NodePosition3D>();
    const groupArcs: GroupArc3D[] = [];
    let currentAngle = -Math.PI / 2;

    for (const key of activeGroups) {
      const group = groups.get(key) ?? [];
      const groupStart = currentAngle - halfGap;
      const z = GROUP_Z[key] ?? 0;

      for (const node of group) {
        const angle = currentAngle;
        positions.set(node.id, {
          x: RING_RADIUS * Math.cos(angle),
          y: RING_RADIUS * Math.sin(angle),
          z,
          angle,
        });
        currentAngle += nodeArcRadians;
      }

      const groupEnd = currentAngle - nodeArcRadians + halfGap;
      groupArcs.push({
        key,
        startAngle: groupStart,
        endAngle: groupEnd,
        color: GROUP_COLORS[key] ?? "#2E4052",
      });

      currentAngle += GAP_FRACTION * 2 * Math.PI;
    }

    return { positions, groupArcs };
  }, [nodes]);
}

export function nodeRadius3D(fileSize: number): number {
  const min = 300;
  const max = 15000;
  const clamped = Math.max(min, Math.min(max, fileSize));
  const t = (clamped - min) / (max - min);
  return 3 + t * 9;
}

// Compute a 3D bezier control point for an edge
export function edgeControlPoint(
  src: NodePosition3D,
  tgt: NodePosition3D,
  edgeType: "reference" | "foundation" | "sibling"
): Vector3 {
  const s = new Vector3(src.x, src.y, src.z);
  const t = new Vector3(tgt.x, tgt.y, tgt.z);
  const mid = s.clone().add(t).multiplyScalar(0.5);

  let inwardFraction: number;
  if (edgeType === "foundation") {
    inwardFraction = 0.88;
  } else if (edgeType === "sibling") {
    inwardFraction = 0.25;
  } else {
    inwardFraction = 0.50;
  }

  // Pull midpoint toward origin
  return mid.clone().multiplyScalar(1 - inwardFraction);
}
