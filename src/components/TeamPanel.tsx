import { useMemo } from "react";
import type { GraphNode, GraphEdge } from "../lib/types";

interface TeamContribution {
  author: string;
  color: string;
  role: string;
  connectedNodes: string[];
}

const AUTHOR_COLORS: Record<string, string> = {
  team: "#5A7E96",
  gus: "#BF5F49",
  elena: "#B8862F",
  karl: "#5E8F64",
  yuki: "#5A7E96",
};

function deriveTeamView(node: GraphNode, allNodes: GraphNode[], allEdges: GraphEdge[]): TeamContribution[] {
  const contributions: TeamContribution[] = [];

  const connectedIds = new Set<string>();
  allEdges.forEach(e => {
    if (e.source === node.id) connectedIds.add(e.target);
    if (e.target === node.id) connectedIds.add(e.source);
  });

  // Primary author
  const authorColor = AUTHOR_COLORS[node.author.toLowerCase()] || "#5A7E96";
  const authorConnected = allNodes
    .filter(n => connectedIds.has(n.id) && n.author.toLowerCase() === node.author.toLowerCase())
    .map(n => n.name);
  contributions.push({
    author: node.author,
    color: authorColor,
    role: "Author",
    connectedNodes: authorConnected,
  });

  // Connected authors
  const seen = new Set<string>([node.author.toLowerCase()]);
  allNodes.forEach(n => {
    if (connectedIds.has(n.id) && !seen.has(n.author.toLowerCase())) {
      seen.add(n.author.toLowerCase());
      const color = AUTHOR_COLORS[n.author.toLowerCase()] || "#5A7E96";
      const theirNodes = allNodes
        .filter(cn => connectedIds.has(cn.id) && cn.author.toLowerCase() === n.author.toLowerCase())
        .map(cn => cn.name);
      contributions.push({
        author: n.author,
        color,
        role: "Linked",
        connectedNodes: theirNodes,
      });
    }
  });

  return contributions;
}

export function TeamPanel({ node, allNodes, allEdges }: {
  node: GraphNode | null;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
}) {
  const contributions = useMemo(
    () => node ? deriveTeamView(node, allNodes, allEdges) : [],
    [node, allNodes, allEdges],
  );

  if (!node) {
    return (
      <div style={{ fontSize: 13, fontWeight: 500, color: "#78868F", padding: "8px 0", lineHeight: 1.5 }}>
        Select a node on the graph.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#78868F", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Contributors
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#78868F" }}>
          {contributions.length}
        </span>
      </div>

      {/* Members */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {contributions.map(member => (
          <div
            key={member.author}
            className="panel-row"
            style={{ padding: "8px", borderRadius: 4 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: member.color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: "#2E4052", fontWeight: 700, flex: 1, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {member.author}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 500,
                padding: "2px 5px",
                borderRadius: 2,
                background: member.role === "Author" ? "rgba(45, 55, 72, 0.08)" : "rgba(0,0,0,0.03)",
                color: member.role === "Author" ? "#2E4052" : "#78868F",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                {member.role}
              </span>
            </div>

            {member.connectedNodes.length > 0 && (
              <div style={{ paddingLeft: 13, display: "flex", flexWrap: "wrap", gap: 3 }}>
                {member.connectedNodes.map(name => (
                  <span key={name} style={{
                    fontSize: 12, fontWeight: 500,
                    padding: "1px 5px",
                    borderRadius: 2,
                    background: "rgba(0,0,0,0.04)",
                    color: "#78868F",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
