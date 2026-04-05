import { useState, useCallback, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { KnowledgeGraph3D } from "./components/KnowledgeGraph3D";
import { FilterBar } from "./components/FilterBar";
import { useGraphData } from "./hooks/useGraphData";
import type { GraphNode } from "./lib/types";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "#2D3748", padding: 40, fontFamily: "var(--font-sans)", background: "#F0F0F0", minHeight: "100vh" }}>
          <h1 style={{ marginBottom: 16 }}>Runtime Error</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#4A5568" }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const {
    fullData,
    filteredData,
    filters,
    authors,
    allProjects,
    selectedNode,
    setSelectedNode,
    isNodeDimmed,
    getConnectedNodes,
    toggleScope,
    toggleProject,
    setAuthorLens,
    setSearch,
  } = useGraphData();

  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const highlightedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedNode) {
      set.add(selectedNode.id);
      getConnectedNodes(selectedNode.id).forEach(n => set.add(n.id));
    }
    if (hoveredNode && !selectedNode) {
      set.add(hoveredNode.id);
    }
    return set;
  }, [selectedNode, hoveredNode, getConnectedNodes]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    navigator.clipboard.writeText(node.body);
    setCopiedId(node.id);
  }, [setSelectedNode]);

  const handleDeselect = useCallback(() => {
    setSelectedNode(null);
    setCopiedId(null);
    setFilterOpen(false);
  }, [setSelectedNode]);

  const handleCopyFromHover = useCallback((node: GraphNode) => {
    navigator.clipboard.writeText(node.body);
    setCopiedId(node.id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  if (filteredData.nodes.length === 0) {
    return (
      <div style={{ color: "#2D3748", padding: 40 }}>
        <h1>No nodes loaded</h1>
        <pre>{JSON.stringify({ nodeCount: fullData.nodes.length, edgeCount: fullData.edges.length }, null, 2)}</pre>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#F0F0F0",
    }}>
      <FilterBar
        scopes={filters.scopes}
        projects={filters.projects}
        authorLens={filters.authorLens}
        authors={authors}
        allProjects={allProjects}
        search={filters.search}
        open={filterOpen}
        onToggleOpen={() => setFilterOpen(o => !o)}
        onToggleScope={toggleScope}
        onToggleProject={toggleProject}
        onSetAuthorLens={setAuthorLens}
        onSetSearch={setSearch}
        nodeCount={filteredData.nodes.length}
        edgeCount={filteredData.edges.length}
      />

      <KnowledgeGraph3D
        nodes={filteredData.nodes}
        edges={filteredData.edges}
        isNodeDimmed={isNodeDimmed}
        onNodeClick={handleNodeClick}
        onNodeHover={setHoveredNode}
        onDeselect={handleDeselect}
        selectedNodeId={selectedNode?.id ?? null}
        highlightedNodeIds={highlightedNodeIds}
      />

      {/* Hover tooltip */}
      {hoveredNode && (
        <div style={{
          position: "fixed",
          top: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          padding: "12px 14px",
          borderRadius: 8,
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
          maxWidth: 340,
        }}>
          <div style={{ fontSize: 13, color: "#2D3748", fontWeight: 500, lineHeight: 1.3 }}>
            {hoveredNode.name}
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: "#8A95A3", lineHeight: 1.45 }}>
            {hoveredNode.description}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyFromHover(hoveredNode); }}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: copiedId === hoveredNode.id ? "#2D3748" : "rgba(0,0,0,0.05)",
                color: copiedId === hoveredNode.id ? "#fff" : "#8A95A3",
                transition: "all 0.15s",
                userSelect: "none",
              }}
              onMouseOver={(e) => { if (copiedId !== hoveredNode.id) { e.currentTarget.style.background = "rgba(0,0,0,0.08)"; e.currentTarget.style.color = "#2D3748"; }}}
              onMouseOut={(e) => { if (copiedId !== hoveredNode.id) { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "#8A95A3"; }}}
            >
              {copiedId === hoveredNode.id ? "Copied" : "Click to copy"}
            </button>
          </div>
        </div>
      )}

    </div>
    </ErrorBoundary>
  );
}
