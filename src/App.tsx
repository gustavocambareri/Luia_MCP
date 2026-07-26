import { useState, useCallback, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { KnowledgeGraph3D } from "./components/KnowledgeGraph3D";
import { FilterBar } from "./components/FilterBar";
import type { View } from "./components/FilterBar";
import { useGraphData } from "./hooks/useGraphData";
import type { GraphNode } from "./lib/types";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "#2E4052", padding: 40, fontFamily: "var(--font-sans)", background: "#F4F2ED", minHeight: "100vh" }}>
          <h1 style={{ marginBottom: 16 }}>Runtime Error</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#5A6B7C" }}>{this.state.error.message}</pre>
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
  const [activeView, setActiveView] = useState<View>("graph");

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
  }, [setSelectedNode]);

  const handleCopyFromHover = useCallback((node: GraphNode) => {
    navigator.clipboard.writeText(node.body);
    setCopiedId(node.id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  if (filteredData.nodes.length === 0) {
    return (
      <div style={{ color: "#2E4052", padding: 40 }}>
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
      background: "#F4F2ED",
    }}>
      <FilterBar
        scopes={filters.scopes}
        projects={filters.projects}
        authorLens={filters.authorLens}
        authors={authors}
        allProjects={allProjects}
        search={filters.search}
        open={filterOpen}
        activeView={activeView}
        selectedNode={selectedNode}
        allNodes={filteredData.nodes}
        allEdges={filteredData.edges}
        onToggleOpen={() => setFilterOpen(o => !o)}
        onClose={() => setFilterOpen(false)}
        onToggleScope={toggleScope}
        onToggleProject={toggleProject}
        onSetAuthorLens={setAuthorLens}
        onSetSearch={setSearch}
        onSetView={(view: View) => { setActiveView(view); setFilterOpen(true); }}
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
          <div style={{ fontSize: 13, color: "#2E4052", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.3 }}>
            {hoveredNode.name}
          </div>
          <div style={{ fontSize: 12, marginTop: 5, color: "#5A6B7C", fontWeight: 500, lineHeight: 1.45 }}>
            {hoveredNode.description}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyFromHover(hoveredNode); }}
              style={{
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: copiedId === hoveredNode.id ? "#2E4052" : "rgba(0,0,0,0.05)",
                color: copiedId === hoveredNode.id ? "#fff" : "#5A6B7C",
                transition: "all 0.15s",
                userSelect: "none",
              }}
              onMouseOver={(e) => { if (copiedId !== hoveredNode.id) { e.currentTarget.style.background = "rgba(0,0,0,0.08)"; e.currentTarget.style.color = "#2E4052"; }}}
              onMouseOut={(e) => { if (copiedId !== hoveredNode.id) { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; e.currentTarget.style.color = "#5A6B7C"; }}}
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
