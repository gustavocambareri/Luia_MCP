import { useState, useMemo } from "react";
import type { GraphNode } from "../lib/types";

interface Decision {
  id: string;
  title: string;
  body: string;
  scope: "visual" | "layout" | "interaction" | "system";
}

const SCOPE_STYLES: Record<string, { bg: string; color: string }> = {
  visual: { bg: "rgba(191, 95, 73, 0.12)", color: "#BF5F49" },
  layout: { bg: "rgba(94, 143, 100, 0.12)", color: "#5E8F64" },
  interaction: { bg: "rgba(184, 134, 47, 0.12)", color: "#B8862F" },
  system: { bg: "rgba(90, 126, 150, 0.12)", color: "#5A7E96" },
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
          <span style={{ color: "#78868F", flexShrink: 0, lineHeight: 1.55 }}>·</span>
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
            <span style={{ fontWeight: 600, color: "#2E4052" }}>{cells[0]}</span>
            {cells.length > 1 && (
              <span style={{ color: "#5A6B7C" }}> — {cells.slice(1).join(" · ")}</span>
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
      <div style={{ fontSize: 13, fontWeight: 500, color: "#78868F", padding: "8px 0", lineHeight: 1.5 }}>
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
                padding: "6px 12px",
                fontSize: 11, fontWeight: 700,
                borderRadius: 5,
                border: "none",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                background: active ? style.bg : "rgba(0,0,0,0.03)",
                color: active ? style.color : "#5A6B7C",
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
          <div style={{ fontSize: 13, fontWeight: 500, color: "#78868F", padding: "8px 0" }}>
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
                  fontSize: 12,
                  padding: "2px 5px",
                  borderRadius: 2,
                  background: scopeStyle.bg,
                  color: scopeStyle.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 600,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {decision.scope}
                </span>
                <div style={{ fontSize: 12, color: "#2E4052", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.35 }}>
                  {decision.title}
                </div>
              </div>
              {/* Body: full width, no indent */}
              {isExpanded && decision.body && (
                <div style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(0,0,0,0.04)",
                  fontSize: 13, fontWeight: 500,
                  color: "#5A6B7C",
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
