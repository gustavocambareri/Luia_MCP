import { useRef, useEffect, useState, useMemo } from "react";
import {
  zoom as d3Zoom,
  zoomIdentity,
  select,
} from "d3";
import type { GraphNode, GraphEdge } from "../lib/types";
import { getNodeColor, hexToRgba } from "../lib/colors";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isNodeDimmed: (id: string) => boolean;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
  onEdgeClick: (edge: GraphEdge) => void;
  onEdgeHover: (edge: GraphEdge | null) => void;
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  width: number;
  height: number;
}

interface NodePosition {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

interface GroupArc {
  key: string;
  startAngle: number;
  endAngle: number;
  color: string;
}

function nodeRadius(fileSize: number): number {
  const min = 300;
  const max = 15000;
  const clamped = Math.max(min, Math.min(max, fileSize));
  const t = (clamped - min) / (max - min);
  return 6 + t * 16;
}

const GROUP_ORDER = ["team", "museon", "pulse", "solara"];
const GAP_FRACTION = 0.045;

function getGroupKey(node: GraphNode): string {
  if (node.scope === "team") return "team";
  return node.project ?? node.scope;
}

const GROUP_COLORS: Record<string, string> = {
  team: "#4f6d7a",
  museon: "#fc0000",
  pulse: "#fcef00",
  solara: "#00fc26",
};

const GROUP_LABELS: Record<string, string> = {
  team: "Team Knowledge",
  museon: "Museon",
  pulse: "Pulse",
  solara: "Solara",
};


function computeRingLayout(
  nodes: GraphNode[],
  width: number,
  height: number
): { positions: Map<string, NodePosition>; groupArcs: GroupArc[]; ringRadius: number } {
  if (nodes.length === 0) return { positions: new Map(), groupArcs: [], ringRadius: 0 };

  const cx = width / 2;
  const cy = height / 2;
  const ringRadius = Math.min(width, height) * 0.36;

  // Group nodes
  const groups = new Map<string, GraphNode[]>();
  for (const key of GROUP_ORDER) groups.set(key, []);

  for (const node of nodes) {
    const key = getGroupKey(node);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  // Sort within each group alphabetically
  for (const group of groups.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }

  const activeGroups = GROUP_ORDER.filter(k => (groups.get(k)?.length ?? 0) > 0);
  const N = nodes.length;
  const numGaps = activeGroups.length;
  const halfGap = (GAP_FRACTION * Math.PI) / 2; // half-gap padding inside each arc
  const totalGapRadians = numGaps * GAP_FRACTION * 2 * Math.PI;
  const nodeArcRadians = (2 * Math.PI - totalGapRadians) / N;

  const positions = new Map<string, NodePosition>();
  const groupArcs: GroupArc[] = [];
  let currentAngle = -Math.PI / 2;

  for (const key of activeGroups) {
    const group = groups.get(key) ?? [];
    const groupStart = currentAngle - halfGap;

    for (const node of group) {
      const angle = currentAngle;
      positions.set(node.id, {
        x: cx + ringRadius * Math.cos(angle),
        y: cy + ringRadius * Math.sin(angle),
        angle,
        radius: ringRadius,
      });
      currentAngle += nodeArcRadians;
    }

    const groupEnd = currentAngle - nodeArcRadians + halfGap;
    groupArcs.push({
      key,
      startAngle: groupStart,
      endAngle: groupEnd,
      color: GROUP_COLORS[key] ?? "#4F6D7A",
    });

    currentAngle += GAP_FRACTION * 2 * Math.PI;
  }

  return { positions, groupArcs, ringRadius };
}

// SVG arc path for a thick ring segment
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// Midpoint angle of an arc for label placement
function arcMidAngle(startAngle: number, endAngle: number): number {
  return (startAngle + endAngle) / 2;
}

function bezierControlPoint(
  sx: number, sy: number,
  tx: number, ty: number,
  cx: number, cy: number,
  edgeType: GraphEdge["type"]
): { cpx: number; cpy: number } {
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  let inwardFraction: number;
  if (edgeType === "foundation") {
    // Deep center-pass: control point very close to center
    inwardFraction = 0.12;
    return {
      cpx: cx + (midX - cx) * inwardFraction,
      cpy: cy + (midY - cy) * inwardFraction,
    };
  } else if (edgeType === "sibling") {
    // Tight perimeter arc: pull chord midpoint slightly toward center
    inwardFraction = 0.25;
    return {
      cpx: midX + (cx - midX) * inwardFraction,
      cpy: midY + (cy - midY) * inwardFraction,
    };
  } else {
    // reference: medium curve
    inwardFraction = 0.50;
    return {
      cpx: midX + (cx - midX) * inwardFraction,
      cpy: midY + (cy - midY) * inwardFraction,
    };
  }
}

export function KnowledgeGraph({
  nodes,
  edges,
  isNodeDimmed,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  onEdgeHover,
  selectedNodeId,
  highlightedNodeIds,
  width,
  height,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const cx = width / 2;
  const cy = height / 2;

  // Compute ring positions geometrically — no simulation needed
  const { positions, groupArcs, ringRadius } = useMemo(
    () => computeRingLayout(nodes, width, height),
    [nodes, width, height]
  );

  // Zoom/pan
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior);
    svg.call(zoomBehavior.transform, zoomIdentity);

    return () => { svg.on(".zoom", null); };
  }, [width, height]);

  // Compute edge paths
  const edgePaths = edges.map(e => {
    const s = positions.get(e.source);
    const t = positions.get(e.target);
    if (!s || !t) return null;
    const { cpx, cpy } = bezierControlPoint(s.x, s.y, t.x, t.y, cx, cy, e.type);
    return { edge: e, sx: s.x, sy: s.y, tx: t.x, ty: t.y, cpx, cpy };
  }).filter(Boolean) as {
    edge: GraphEdge;
    sx: number; sy: number;
    tx: number; ty: number;
    cpx: number; cpy: number;
  }[];

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0, background: "transparent" }}
    >
      <g ref={gRef}>
        {/* Group arc guides */}
        {groupArcs.map(arc => {
          const mid = arcMidAngle(arc.startAngle, arc.endAngle);
          const labelR = ringRadius + 52;
          const lx = cx + labelR * Math.cos(mid);
          const ly = cy + labelR * Math.sin(mid);
          const angleDeg = mid * (180 / Math.PI);
          const isLeft = Math.cos(mid) < 0;
          return (
            <g key={arc.key}>
              <path
                d={arcPath(cx, cy, ringRadius + 28, arc.startAngle, arc.endAngle)}
                fill="none"
                stroke={arc.color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.25}
              />
              {/* Group label — halo */}
              <text
                x={lx} y={ly}
                textAnchor={isLeft ? "end" : "start"}
                dominantBaseline="middle"
                transform={`rotate(${isLeft ? angleDeg + 180 : angleDeg}, ${lx}, ${ly})`}
                fill="none"
                stroke="rgba(219,233,238,0.93)"
                strokeWidth={4}
                strokeLinejoin="round"
                fontSize={9}
                fontFamily="Pantasia, serif"
                fontWeight={600}
                letterSpacing="0.08em"
                pointerEvents="none"
              >
                {GROUP_LABELS[arc.key] ?? arc.key}
              </text>
              {/* Group label — ink */}
              <text
                x={lx} y={ly}
                textAnchor={isLeft ? "end" : "start"}
                dominantBaseline="middle"
                transform={`rotate(${isLeft ? angleDeg + 180 : angleDeg}, ${lx}, ${ly})`}
                fill={arc.color}
                fontSize={9}
                fontFamily="Pantasia, serif"
                fontWeight={600}
                letterSpacing="0.08em"
                opacity={0.6}
                pointerEvents="none"
              >
                {GROUP_LABELS[arc.key] ?? arc.key}
              </text>
            </g>
          );
        })}

        {/* Gradient defs — one per edge, source→target color */}
        <defs>
          {edgePaths.map((l, i) => {
            const srcNode = nodes.find(n => n.id === l.edge.source);
            const tgtNode = nodes.find(n => n.id === l.edge.target);
            const c1 = srcNode ? getNodeColor(srcNode.scope, srcNode.project) : "#4f6d7a";
            const c2 = tgtNode ? getNodeColor(tgtNode.scope, tgtNode.project) : "#4f6d7a";
            return (
              <linearGradient
                key={`grad-${i}`}
                id={`grad-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={l.sx} y1={l.sy} x2={l.tx} y2={l.ty}
              >
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Edges */}
        {edgePaths.map((l, i) => {
          const isActive = selectedNodeId && (l.edge.source === selectedNodeId || l.edge.target === selectedNodeId);
          const isHoverActive = hoveredId && (l.edge.source === hoveredId || l.edge.target === hoveredId);
          const dimmed = isNodeDimmed(l.edge.source) && isNodeDimmed(l.edge.target);
          const active = isActive || isHoverActive;
          const anyActive = selectedNodeId || hoveredId;

          const baseOpacity = active ? 0.85
            : anyActive ? 0.04
            : dimmed ? 0.03
            : l.edge.type === "foundation" ? 0.18
            : l.edge.type === "reference" ? 0.55
            : 0.3;

          return (
            <g key={`e-${i}`}>
              {/* Invisible wider hit area */}
              <path
                d={`M ${l.sx} ${l.sy} Q ${l.cpx} ${l.cpy} ${l.tx} ${l.ty}`}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onClick={() => onEdgeClick(l.edge)}
                onMouseEnter={() => onEdgeHover(l.edge)}
                onMouseLeave={() => onEdgeHover(null)}
                cursor="pointer"
              />
              <path
                d={`M ${l.sx} ${l.sy} Q ${l.cpx} ${l.cpy} ${l.tx} ${l.ty}`}
                fill="none"
                stroke={`url(#grad-${i})`}
                strokeWidth={active ? 1.8 : l.edge.type === "reference" ? 1.2 : 0.75}
                strokeOpacity={baseOpacity}
                style={{ transition: "stroke-opacity 0.25s, stroke-width 0.25s" }}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const r = nodeRadius(node.fileSize);
          const color = getNodeColor(node.scope, node.project);
          const dimmed = isNodeDimmed(node.id);
          const isSelected = node.id === selectedNodeId;
          const isHovered = node.id === hoveredId;
          const isHighlighted = highlightedNodeIds.has(node.id);
          const isActive = isSelected || isHovered || isHighlighted;

          // Radial label position
          const labelR = ringRadius + r + 14;
          const labelX = cx + labelR * Math.cos(pos.angle);
          const labelY = cy + labelR * Math.sin(pos.angle);
          const angleDeg = pos.angle * (180 / Math.PI);
          const isLeftHalf = Math.cos(pos.angle) < 0;
          const textAnchor = isLeftHalf ? "end" : "start";
          const labelRotate = isLeftHalf ? angleDeg + 180 : angleDeg;

          return (
            <g
              key={node.id}
              opacity={dimmed ? 0.15 : 1}
              style={{ transition: "opacity 0.4s", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
              onMouseEnter={() => { setHoveredId(node.id); onNodeHover(node); }}
              onMouseLeave={() => { setHoveredId(null); onNodeHover(null); }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r + 5} fill="none"
                  stroke={color} strokeWidth={1}
                  strokeDasharray="4 3" opacity={0.45}
                />
              )}

              {/* Node circle */}
              <circle
                cx={pos.x} cy={pos.y}
                r={r}
                fill={color}
                opacity={isActive ? 1 : 0.82}
                style={{ transition: "opacity 0.3s" }}
              />

              {/* Label — halo pass */}
              <text
                x={labelX} y={labelY}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                transform={`rotate(${labelRotate}, ${labelX}, ${labelY})`}
                fill="none"
                stroke="rgba(219,233,238,0.93)"
                strokeWidth={4}
                strokeLinejoin="round"
                fontSize={11}
                fontFamily="Pantasia, serif"
                fontWeight={isActive ? 700 : 500}
                pointerEvents="none"
              >
                {node.name.length > 28 ? node.name.slice(0, 26) + "…" : node.name}
              </text>
              {/* Label — ink pass */}
              <text
                x={labelX} y={labelY}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                transform={`rotate(${labelRotate}, ${labelX}, ${labelY})`}
                fill={isActive ? "#000000" : "#1a1a1a"}
                fontSize={11}
                fontFamily="Pantasia, serif"
                fontWeight={isActive ? 700 : 500}
                pointerEvents="none"
                style={{ transition: "fill 0.3s" }}
              >
                {node.name.length > 28 ? node.name.slice(0, 26) + "…" : node.name}
              </text>

              {/* Subtitle — halo pass */}
              <text
                x={labelX} y={labelY}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                transform={`rotate(${labelRotate}, ${labelX}, ${labelY})`}
                dy="15"
                fill="none"
                stroke="rgba(219,233,238,0.93)"
                strokeWidth={3}
                strokeLinejoin="round"
                fontSize={9}
                fontFamily="Pantasia, serif"
                pointerEvents="none"
              >
                {node.scope === "project" ? node.project : node.scope}
                {node.author !== "team" ? ` · ${node.author}` : ""}
              </text>
              {/* Subtitle — ink pass */}
              <text
                x={labelX} y={labelY}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                transform={`rotate(${labelRotate}, ${labelX}, ${labelY})`}
                dy="15"
                fill={hexToRgba(color, 0.7)}
                fontSize={9}
                fontFamily="Pantasia, serif"
                pointerEvents="none"
              >
                {node.scope === "project" ? node.project : node.scope}
                {node.author !== "team" ? ` · ${node.author}` : ""}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
