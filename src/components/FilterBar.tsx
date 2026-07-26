import { getNodeColor, AUTHOR_COLORS, PROJECT_COLORS, hexToRgba } from "../lib/colors";
import { DecisionLog } from "./DecisionLog";
import type { GraphNode, GraphEdge } from "../lib/types";

export type View = "graph" | "decisions";

interface Props {
  scopes: Set<string>;
  projects: Set<string>;
  authorLens: string | null;
  authors: string[];
  allProjects: string[];
  search: string;
  open: boolean;
  activeView: View;
  selectedNode: GraphNode | null;
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  onToggleOpen: () => void;
  onClose: () => void;
  onToggleScope: (scope: string) => void;
  onToggleProject: (project: string) => void;
  onSetAuthorLens: (author: string | null) => void;
  onSetSearch: (search: string) => void;
  onSetView: (view: View) => void;
  nodeCount: number;
  edgeCount: number;
}

const SCOPES = [
  { key: "team", label: "Team" },
  { key: "project", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "personal", label: "Personal" },
];

const VIEWS: { key: View; label: string }[] = [
  { key: "graph", label: "Graph" },
  { key: "decisions", label: "Decisions" },
];

export function FilterBar({
  scopes,
  projects,
  authorLens,
  authors,
  allProjects,
  search,
  open,
  activeView,
  selectedNode,
  onToggleOpen,
  onClose,
  onToggleScope,
  onToggleProject,
  onSetAuthorLens,
  onSetSearch,
  onSetView,
  nodeCount,
}: Props) {

  return (
    <div className="fixed top-0 left-0 z-50" style={{ userSelect: "none" }}>
      {/* Title + close */}
      <div style={{ padding: "28px 0 0 28px", display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          className="cursor-pointer"
          onClick={onToggleOpen}
          style={{ fontSize: 26, fontWeight: 600, color: "#2E4052", letterSpacing: "0.08em", lineHeight: 1 }}
        >
          LUIA
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#78868F", lineHeight: 1 }}>
          {nodeCount}
        </span>
        {open && (
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 5,
              marginLeft: 2,
              alignSelf: "center",
              position: "relative",
              top: -3,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <line x1="1" y1="1" x2="9" y2="9" stroke="#5A6B7C" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="#5A6B7C" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          margin: "18px 0 0 28px",
          width: activeView === "decisions" ? 380 : 290,
          transition: "width 0.2s ease",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}>
          {/* View tabs */}
          <div style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}>
            {VIEWS.map(({ key, label }) => {
              const active = activeView === key;
              return (
                <button
                  key={key}
                  onClick={() => onSetView(key)}
                  style={{
                    padding: "7px 12px 9px",
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    textTransform: "uppercase",
                    border: "none",
                    borderBottom: active ? "2px solid #2E4052" : "2px solid transparent",
                    cursor: "pointer",
                    background: "transparent",
                    color: active ? "#2E4052" : "#5A6B7C",
                    transition: "color 0.15s, border-color 0.15s",
                    letterSpacing: "0.08em",
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Selected node indicator — visible on decisions tab */}
          {activeView === "decisions" && selectedNode && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 0 6px 0",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: getNodeColor(selectedNode.scope, selectedNode.project),
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13,
                color: "#2E4052",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {selectedNode.name}
              </span>
            </div>
          )}

          {/* Graph filters */}
          {activeView === "graph" && (
            <>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => onSetSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#2E4052",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(0,0,0,0.14)",
                  outline: "none",
                }}
              />

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5A6B7C", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>
                  Scope
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SCOPES.map(({ key, label }) => {
                    const active = scopes.has(key);
                    const color = getNodeColor(key);
                    return (
                      <button key={key} onClick={() => onToggleScope(key)}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          borderRadius: 5,
                          border: "none",
                          cursor: "pointer",
                          background: active ? hexToRgba(color, 0.12) : "rgba(0,0,0,0.03)",
                          color: active ? color : "#5A6B7C",
                          transition: "all 0.15s",
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {scopes.has("project") && allProjects.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5A6B7C", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>
                    Project
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {allProjects.map(proj => {
                      const active = projects.has(proj);
                      const color = PROJECT_COLORS[proj] || "#5A7E96";
                      return (
                        <button key={proj} onClick={() => onToggleProject(proj)}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: "0.07em",
                            borderRadius: 5,
                            border: "none",
                            cursor: "pointer",
                            textTransform: "uppercase",
                            background: active ? hexToRgba(color, 0.12) : "rgba(0,0,0,0.03)",
                            color: active ? color : "#5A6B7C",
                            transition: "all 0.15s",
                          }}>
                          {proj}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {authors.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5A6B7C", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>
                    Author
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {authors.map(author => {
                      const active = authorLens === author;
                      const color = AUTHOR_COLORS[author.toLowerCase()] || "#5A7E96";
                      return (
                        <button key={author} onClick={() => onSetAuthorLens(author)}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: "0.07em",
                            borderRadius: 5,
                            border: "none",
                            cursor: "pointer",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: active ? hexToRgba(color, 0.12) : "rgba(0,0,0,0.03)",
                            color: active ? color : "#5A6B7C",
                            transition: "all 0.15s",
                          }}>
                          <span style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: color,
                            opacity: active ? 1 : 0.4,
                          }} />
                          {author}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Decisions panel */}
          {activeView === "decisions" && (
            <div className="panel-scroll">
              <DecisionLog node={selectedNode} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
