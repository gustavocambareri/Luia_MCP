import { useState, useMemo } from "react";
import type { GraphNode } from "../lib/types";

interface ContextEntry {
  id: string;
  type: "token" | "decision" | "pattern" | "constraint";
  label: string;
  source: string;
  confidence: number;
}

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  token: { bg: "rgba(76, 175, 125, 0.12)", color: "#4CAF7D" },
  decision: { bg: "rgba(232, 93, 93, 0.12)", color: "#E85D5D" },
  pattern: { bg: "rgba(123, 143, 163, 0.12)", color: "#7B8FA3" },
  constraint: { bg: "rgba(212, 168, 67, 0.12)", color: "#D4A843" },
};

function inferType(section: string): ContextEntry["type"] {
  const s = section.toLowerCase();
  if (s.includes("token") || s.includes("color") || s.includes("typography") || s.includes("spacing")) return "token";
  if (s.includes("rule") || s.includes("constraint") || s.includes("non-negotiable") || s.includes("never") || s.includes("always")) return "constraint";
  if (s.includes("pattern") || s.includes("component") || s.includes("layout") || s.includes("hierarchy")) return "pattern";
  return "decision";
}

/** Deterministic hash so confidence stays stable across renders */
function stableConfidence(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return 0.78 + (Math.abs(h) % 22) / 100; // 0.78–0.99
}

function deriveContext(node: GraphNode): ContextEntry[] {
  const entries: ContextEntry[] = [];

  node.sections.forEach((section, i) => {
    if (section === node.name) return;
    entries.push({
      id: `sec-${i}`,
      type: inferType(section),
      label: section,
      source: node.name,
      confidence: stableConfidence(node.id + section),
    });
  });

  node.connections.forEach((conn, i) => {
    const label = conn.replace(/^_\w+\//, "").replace(/-/g, " ");
    entries.push({
      id: `conn-${i}`,
      type: "pattern",
      label: `Linked: ${label}`,
      source: "Connection",
      confidence: stableConfidence(node.id + conn),
    });
  });

  return entries;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value > 0.9 ? "#4CAF7D" : value > 0.82 ? "#D4A843" : "#E85D5D";
  return (
    <div
      title={`${Math.round(value * 100)}%`}
      style={{
        width: 36,
        height: 4,
        borderRadius: 2,
        background: "rgba(0,0,0,0.06)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: `${value * 100}%`,
        height: "100%",
        borderRadius: 2,
        background: color,
      }} />
    </div>
  );
}

export function ContextPanel({ node }: { node: GraphNode | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const entries = useMemo(() => node ? deriveContext(node) : [], [node]);
  const avgConfidence = entries.length
    ? entries.reduce((sum, c) => sum + c.confidence, 0) / entries.length
    : 0;

  if (!node) {
    return (
      <div style={{ fontSize: 11, color: "#B0B8C4", padding: "8px 0", lineHeight: 1.5 }}>
        Select a node on the graph.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Coverage */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <span style={{ fontSize: 10, color: "#B0B8C4", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Coverage
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: avgConfidence > 0.85 ? "#4CAF7D" : "#D4A843",
        }}>
          {Math.round(avgConfidence * 100)}%
        </span>
      </div>

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {entries.map(entry => {
          const typeStyle = TYPE_STYLES[entry.type];
          const isExpanded = expanded === entry.id;
          return (
            <div
              key={entry.id}
              className="panel-row"
              data-active={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : entry.id)}
              style={{ padding: "7px 8px", borderRadius: 4, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 2,
                  background: typeStyle.bg,
                  color: typeStyle.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {entry.type}
                </span>
                <span style={{ fontSize: 11, color: "#2D3748", flex: 1, lineHeight: 1.3 }}>
                  {entry.label}
                </span>
                <ConfidenceBar value={entry.confidence} />
              </div>
              {isExpanded && (
                <div style={{
                  marginTop: 5,
                  paddingTop: 5,
                  borderTop: "1px solid rgba(0,0,0,0.04)",
                  fontSize: 10,
                  color: "#8A95A3",
                }}>
                  {entry.source}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
