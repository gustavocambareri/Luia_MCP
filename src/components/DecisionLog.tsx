import { useState, useMemo } from "react";
import type { GraphNode } from "../lib/types";

interface Decision {
  id: string;
  title: string;
  body: string;
  scope: "visual" | "layout" | "interaction" | "system";
}

const SCOPE_STYLES: Record<string, { bg: string; color: string }> = {
  visual: { bg: "rgba(232, 93, 93, 0.12)", color: "#E85D5D" },
  layout: { bg: "rgba(76, 175, 125, 0.12)", color: "#4CAF7D" },
  interaction: { bg: "rgba(212, 168, 67, 0.12)", color: "#D4A843" },
  system: { bg: "rgba(123, 143, 163, 0.12)", color: "#7B8FA3" },
};

function inferScope(text: string): Decision["scope"] {
  const t = text.toLowerCase();
  if (t.includes("color") || t.includes("font") || t.includes("typograph") || t.includes("image") || t.includes("icon")) return "visual";
  if (t.includes("layout") || t.includes("grid") || t.includes("spacing") || t.includes("auto-layout") || t.includes("mobile") || t.includes("responsive")) return "layout";
  if (t.includes("animation") || t.includes("motion") || t.includes("hover") || t.includes("click") || t.includes("scroll") || t.includes("carousel") || t.includes("accordion")) return "interaction";
  return "system";
}

function extractDecisions(node: GraphNode): Decision[] {
  const decisions: Decision[] = [];
  const lines = node.body.split("\n");

  let currentHeading = "";
  let bodyLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeading && bodyLines.length > 0) {
        const fullBody = bodyLines.join("\n").trim();
        decisions.push({
          id: `dec-${decisions.length}`,
          title: currentHeading,
          body: fullBody,
          scope: inferScope(currentHeading + " " + fullBody),
        });
      }
      currentHeading = line.replace("## ", "").trim();
      bodyLines = [];
    } else if (currentHeading && !line.startsWith("# ")) {
      // Collect everything under the heading: paragraphs, lists, tables, code
      bodyLines.push(line);
    }
  }

  // Push last section
  if (currentHeading && bodyLines.length > 0) {
    const fullBody = bodyLines.join("\n").trim();
    decisions.push({
      id: `dec-${decisions.length}`,
      title: currentHeading,
      body: fullBody,
      scope: inferScope(currentHeading + " " + fullBody),
    });
  }

  // Fallback: use sections
  if (decisions.length === 0) {
    node.sections.forEach((section, i) => {
      if (section === node.name) return;
      decisions.push({
        id: `sec-${i}`,
        title: section,
        body: "",
        scope: inferScope(section),
      });
    });
  }

  return decisions;
}

/** Render markdown-ish body as simple styled blocks */
function DecisionBody({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) { i++; continue; }

    // Skip "See: [[...]]" references
    if (line.trim().startsWith("See:")) { i++; continue; }

    // List items
    if (line.trim().startsWith("- ")) {
      elements.push(
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
          <span style={{ color: "#B0B8C4", flexShrink: 0, lineHeight: 1.55 }}>·</span>
          <span style={{ wordBreak: "break-word" }}>{line.trim().slice(2)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Code blocks — skip
    if (line.trim().startsWith("```")) {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) i++;
      i++;
      continue;
    }

    // Table rows — render first cell as label, rest as value below
    if (line.trim().startsWith("|")) {
      if (line.includes("---")) { i++; continue; }
      const cells = line.split("|").filter(c => c.trim()).map(c => c.trim());
      if (cells.length > 0) {
        elements.push(
          <div key={i} style={{ marginBottom: 3 }}>
            <span style={{ fontWeight: 500, color: "#2D3748" }}>{cells[0]}</span>
            {cells.length > 1 && (
              <span style={{ color: "#8A95A3" }}> — {cells.slice(1).join(" · ")}</span>
            )}
          </div>
        );
      }
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} style={{ marginBottom: 6, wordBreak: "break-word" }}>{line.trim()}</p>
    );
    i++;
  }

  return <>{elements}</>;
}

export function DecisionLog({ node }: { node: GraphNode | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<string | null>(null);
  const allDecisions = useMemo(() => node ? extractDecisions(node) : [], [node]);

  if (!node) {
    return (
      <div style={{ fontSize: 11, color: "#B0B8C4", padding: "8px 0", lineHeight: 1.5 }}>
        Select a node on the graph.
      </div>
    );
  }

  const filtered = filterScope
    ? allDecisions.filter(d => d.scope === filterScope)
    : allDecisions;

  const scopes = ["visual", "layout", "interaction", "system"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Scope filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {scopes.map(scope => {
          const active = filterScope === scope;
          const style = SCOPE_STYLES[scope];
          return (
            <button
              key={scope}
              onClick={() => setFilterScope(active ? null : scope)}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                borderRadius: 3,
                border: "none",
                cursor: "pointer",
                textTransform: "capitalize",
                background: active ? style.bg : "rgba(0,0,0,0.03)",
                color: active ? style.color : "#8A95A3",
                transition: "all 0.15s",
              }}
            >
              {scope}
            </button>
          );
        })}
      </div>

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 11, color: "#B0B8C4", padding: "8px 0" }}>
            No matches.
          </div>
        )}
        {filtered.map(decision => {
          const isExpanded = expanded === decision.id;
          const scopeStyle = SCOPE_STYLES[decision.scope];

          return (
            <div
              key={decision.id}
              className="panel-row"
              data-active={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : decision.id)}
              style={{ padding: "8px", borderRadius: 4, cursor: "pointer" }}
            >
              {/* Header: badge + title */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 2,
                  background: scopeStyle.bg,
                  color: scopeStyle.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 500,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {decision.scope}
                </span>
                <div style={{ fontSize: 11, color: "#2D3748", fontWeight: 500, lineHeight: 1.3 }}>
                  {decision.title}
                </div>
              </div>
              {/* Body: full width, no indent */}
              {isExpanded && decision.body && (
                <div style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(0,0,0,0.04)",
                  fontSize: 11,
                  color: "#8A95A3",
                  lineHeight: 1.55,
                }}>
                  <DecisionBody text={decision.body} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
