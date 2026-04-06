import { useMemo } from "react";
import type { GraphNode } from "../lib/types";

interface PromptEntry {
  id: string;
  prompt: string;
  outcome: "accepted" | "rejected" | "iterated";
  iterations: number;
  tool: string;
  timestamp: string;
}

const OUTCOME_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  accepted: { bg: "rgba(76, 175, 125, 0.12)", color: "#4CAF7D", label: "✓" },
  rejected: { bg: "rgba(232, 93, 93, 0.12)", color: "#E85D5D", label: "✗" },
  iterated: { bg: "rgba(212, 168, 67, 0.12)", color: "#D4A843", label: "↻" },
};

function generateActivity(node: GraphNode): PromptEntry[] {
  const sections = node.sections.filter(s => s !== node.name);
  const times = ["2m ago", "8m ago", "15m ago", "22m ago", "35m ago", "1h ago", "2h ago"];

  const templates: Omit<PromptEntry, "id" | "timestamp">[] = [
    { prompt: `Apply "${sections[0] || node.name}" to current design`, outcome: "accepted", iterations: 1, tool: "figma" },
    { prompt: `Check consistency with ${node.name}`, outcome: "accepted", iterations: 1, tool: "figma" },
    { prompt: `Build component following ${sections[1] || "guidelines"}`, outcome: "iterated", iterations: 3, tool: "figma" },
    { prompt: `Validate layout against ${node.name}`, outcome: "accepted", iterations: 2, tool: "figma" },
    { prompt: `Generate tokens from ${node.name}`, outcome: "accepted", iterations: 1, tool: "tokens" },
  ];

  if (node.scope === "team") {
    templates.push({ prompt: `Update docs with new ${sections[2] || "pattern"}`, outcome: "iterated", iterations: 2, tool: "code" });
  }
  if (node.scope === "project") {
    templates.push(
      { prompt: `Implement ${node.project || "project"} section`, outcome: "iterated", iterations: 4, tool: "figma" },
      { prompt: `Extract ${node.project || "project"} tokens`, outcome: "accepted", iterations: 1, tool: "code" },
    );
  }

  return templates.map((t, i) => ({ ...t, id: `act-${i}`, timestamp: times[i] || times[times.length - 1] }));
}

export function ActivityPanel({ node }: { node: GraphNode | null }) {
  const entries = useMemo(() => node ? generateActivity(node) : [], [node]);

  if (!node) {
    return (
      <div style={{ fontSize: 11, color: "#B0B8C4", padding: "8px 0", lineHeight: 1.5 }}>
        Select a node on the graph.
      </div>
    );
  }

  const accepted = entries.filter(a => a.outcome === "accepted").length;
  const total = entries.length;
  const avgIterations = entries.reduce((sum, a) => sum + a.iterations, 0) / total;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Stats — compact, same hierarchy as the rest */}
      <div style={{
        display: "flex",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        fontSize: 10,
        color: "#B0B8C4",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>
        <span><span style={{ color: "#2D3748", fontWeight: 600 }}>{accepted}/{total}</span> accepted</span>
        <span><span style={{ color: "#2D3748", fontWeight: 600 }}>{avgIterations.toFixed(1)}</span> avg</span>
      </div>

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {entries.map(entry => {
          const outcomeStyle = OUTCOME_STYLES[entry.outcome];
          return (
            <div
              key={entry.id}
              className="panel-row"
              style={{ padding: "7px 8px", borderRadius: 4 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  background: outcomeStyle.bg,
                  color: outcomeStyle.color,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {outcomeStyle.label}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#2D3748", lineHeight: 1.3 }}>
                    {entry.prompt}
                  </div>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 2,
                    fontSize: 10,
                    color: "#B0B8C4",
                  }}>
                    <span>{entry.tool}</span>
                    {entry.iterations > 1 && (
                      <>
                        <span>·</span>
                        <span style={{ color: entry.iterations > 2 ? "#D4A843" : "#B0B8C4" }}>
                          {entry.iterations}x
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{entry.timestamp}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
