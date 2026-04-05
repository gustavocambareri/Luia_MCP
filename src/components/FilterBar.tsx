import { getNodeColor, AUTHOR_COLORS, PROJECT_COLORS, hexToRgba } from "../lib/colors";

interface Props {
  scopes: Set<string>;
  projects: Set<string>;
  authorLens: string | null;
  authors: string[];
  allProjects: string[];
  search: string;
  open: boolean;
  onToggleOpen: () => void;
  onToggleScope: (scope: string) => void;
  onToggleProject: (project: string) => void;
  onSetAuthorLens: (author: string | null) => void;
  onSetSearch: (search: string) => void;
  nodeCount: number;
  edgeCount: number;
}

const SCOPES = [
  { key: "team", label: "Team" },
  { key: "project", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "personal", label: "Personal" },
];

export function FilterBar({
  scopes,
  projects,
  authorLens,
  authors,
  allProjects,
  search,
  open,
  onToggleOpen,
  onToggleScope,
  onToggleProject,
  onSetAuthorLens,
  onSetSearch,
  nodeCount,
}: Props) {

  return (
    <div className="fixed top-0 left-0 z-50" style={{ userSelect: "none" }}>
      {/* Title */}
      <div
        className="cursor-pointer"
        style={{ padding: "28px 0 0 28px", display: "flex", alignItems: "baseline", gap: 8 }}
        onClick={onToggleOpen}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#2D3748", letterSpacing: "0.08em" }}>
          PIERRE
        </span>
        <span style={{ fontSize: 10, color: "#B0B8C4" }}>
          {nodeCount}
        </span>
      </div>

      {/* Filter dropdown */}
      {open && (
        <div style={{
          margin: "12px 0 0 28px",
          width: 180,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => onSetSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 0",
              fontSize: 12,
              color: "#2D3748",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              outline: "none",
            }}
          />

          {/* Scope */}
          <div>
            <div style={{ fontSize: 10, color: "#B0B8C4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Scope
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {SCOPES.map(({ key, label }) => {
                const active = scopes.has(key);
                const color = getNodeColor(key);
                return (
                  <button key={key} onClick={() => onToggleScope(key)}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      borderRadius: 3,
                      border: "none",
                      cursor: "pointer",
                      background: active ? hexToRgba(color, 0.12) : "rgba(0,0,0,0.03)",
                      color: active ? color : "#8A95A3",
                      transition: "all 0.15s",
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projects — only when project scope is active */}
          {scopes.has("project") && allProjects.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#B0B8C4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Project
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {allProjects.map(proj => {
                  const active = projects.has(proj);
                  const color = PROJECT_COLORS[proj] || "#7B8FA3";
                  return (
                    <button key={proj} onClick={() => onToggleProject(proj)}
                      style={{
                        padding: "3px 8px",
                        fontSize: 11,
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        background: active ? hexToRgba(color, 0.12) : "rgba(0,0,0,0.03)",
                        color: active ? color : "#8A95A3",
                        transition: "all 0.15s",
                      }}>
                      {proj}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Author */}
          {authors.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#B0B8C4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Author
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {authors.map(author => {
                  const active = authorLens === author;
                  const color = AUTHOR_COLORS[author.toLowerCase()] || "#7B8FA3";
                  return (
                    <button key={author} onClick={() => onSetAuthorLens(author)}
                      style={{
                        padding: "3px 8px",
                        fontSize: 11,
                        borderRadius: 3,
                        border: "none",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: active ? hexToRgba(color, 0.12) : "rgba(0,0,0,0.03)",
                        color: active ? color : "#8A95A3",
                        transition: "all 0.15s",
                      }}>
                      <span style={{
                        width: 5,
                        height: 5,
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
        </div>
      )}
    </div>
  );
}
