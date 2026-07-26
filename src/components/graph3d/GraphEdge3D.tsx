import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CubicBezierCurve3, Vector3, Color } from "three";
import type { GraphEdge, GraphNode } from "../../lib/types";
import { getNodeColor } from "../../lib/colors";
import type { NodePosition3D } from "./useForceLayout";

interface Props {
  edge: GraphEdge;
  positions: Map<string, NodePosition3D>;
  nodes: GraphNode[];
  active: boolean;
  anyActive: boolean;
  dimmed: boolean;
}

const CURVE_POINTS = 56;

// Stable hash for consistent per-edge variation
function hashEdge(a: string, b: string): number {
  let h = 0;
  const s = a + "|" + b;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Cubic bezier with two control points offset perpendicular to the line,
// each at 1/3 and 2/3 along the path. The offset magnitude and direction
// vary per edge to create flowing, unique arcs like in the inspo.
function computeCurve(
  src: { x: number; y: number; z: number },
  tgt: { x: number; y: number; z: number },
  edgeType: string,
  edgeIndex: number
): Vector3[] {
  const sx = src.x, sy = src.y;
  const tx = tgt.x, ty = tgt.y;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) return [new Vector3(sx, sy, 0), new Vector3(tx, ty, 0)];

  // Normalized perpendicular
  const px = -dy / dist;
  const py = dx / dist;

  // Use hash for consistent variety
  const h = edgeIndex;
  const seed1 = ((h * 7 + 13) % 100) / 100;     // 0–1
  const seed2 = ((h * 13 + 7) % 100) / 100;      // 0–1
  const sign = (h % 2 === 0) ? 1 : -1;

  // Foundation: wide, graceful arcs radiating from center
  // Reference: moderate curves
  // Sibling: very subtle curves (nearby nodes in same cluster)
  const baseBow = edgeType === "foundation" ? 0.3
    : edgeType === "sibling" ? 0.06
    : 0.15;

  const bow1 = dist * baseBow * (0.7 + seed1 * 0.6) * sign;
  const bow2 = dist * baseBow * (0.5 + seed2 * 0.5) * sign;

  // Control points at 1/3 and 2/3 along the line, offset perpendicular
  const cp1x = sx + dx * 0.33 + px * bow1;
  const cp1y = sy + dy * 0.33 + py * bow1;
  const cp2x = sx + dx * 0.66 + px * bow2;
  const cp2y = sy + dy * 0.66 + py * bow2;

  const curve = new CubicBezierCurve3(
    new Vector3(sx, sy, 0),
    new Vector3(cp1x, cp1y, 0),
    new Vector3(cp2x, cp2y, 0),
    new Vector3(tx, ty, 0)
  );

  return curve.getPoints(CURVE_POINTS);
}

export function GraphEdge3D({ edge, positions, nodes, active, anyActive, dimmed }: Props) {
  const src = positions.get(edge.source);
  const tgt = positions.get(edge.target);

  const { points, vertexColors } = useMemo(() => {
    if (!src || !tgt) return { points: [] as Vector3[], vertexColors: [] as [number, number, number][] };

    const pts = computeCurve(src, tgt, edge.type, hashEdge(edge.source, edge.target));

    // Near-monochrome base with subtle node color tint
    const baseColor = new Color("#C3C9CE");
    const srcNode = nodes.find(n => n.id === edge.source);
    const tgtNode = nodes.find(n => n.id === edge.target);
    const c1 = new Color(srcNode ? getNodeColor(srcNode.scope, srcNode.project) : "#C3C9CE");
    const c2 = new Color(tgtNode ? getNodeColor(tgtNode.scope, tgtNode.project) : "#C3C9CE");

    const tintStrength = 0.15;
    const colors: [number, number, number][] = pts.map((_, i) => {
      const t = i / (pts.length - 1 || 1);
      const nodeColor = new Color().lerpColors(c1, c2, t);
      const r = baseColor.r + (nodeColor.r - baseColor.r) * tintStrength;
      const g = baseColor.g + (nodeColor.g - baseColor.g) * tintStrength;
      const b = baseColor.b + (nodeColor.b - baseColor.b) * tintStrength;
      return [r, g, b];
    });

    return { points: pts, vertexColors: colors };
  }, [src, tgt, edge, nodes]);

  if (!src || !tgt || points.length === 0) return null;

  // Edges are nearly invisible by default — they appear on hover/selection
  const opacity = active ? 0.55
    : anyActive ? 0.02
    : dimmed ? 0.0
    : 0.06;

  const lineWidth = active ? 1.0 : 0.5;
  const isDashed = edge.type === "sibling";

  return (
    <Line
      points={points}
      vertexColors={vertexColors}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      dashed={isDashed}
      dashSize={3}
      gapSize={3}
    />
  );
}
