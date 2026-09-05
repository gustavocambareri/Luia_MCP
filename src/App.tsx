import { Component, useCallback, useMemo, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Manifest } from "./components/Manifest";
import { OrbitBody } from "./components/OrbitBody";
import { useManifest } from "./hooks/useManifest";
import type { GraphNode, GraphEdge } from "./lib/types";
import rawData from "./data/graph-data.json";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "var(--sans)", textTransform: "none" }}>
          <h1 style={{ marginBottom: 16, fontSize: 20 }}>Runtime error</h1>
          <pre style={{ whiteSpace: "pre-wrap", opacity: .7 }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const nodes = rawData.nodes as GraphNode[];
  const edges = rawData.edges as GraphEdge[];

  // Team first, then every project the data actually contains, so a new
  // engagement appears without a code change.
  const projects = useMemo(() => {
    const ids = ["team", ...Array.from(new Set(nodes.map(n => n.project).filter((p): p is string => !!p)))];
    return ids.map(id => ({ id, label: id.toUpperCase() }));
  }, [nodes]);

  const m = useManifest(nodes, edges);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const onHover = useCallback((n: GraphNode | null) => setHoveredId(n ? n.id : null), []);

  const visibleIds = useMemo(() => new Set(m.visible.map(n => n.id)), [m.visible]);

  return (
    <ErrorBoundary>
      <div className="app">
        <Manifest
          nodes={nodes}
          projects={projects}
          m={m}
          onHover={onHover}
        />
        <OrbitBody
          nodes={nodes}
          edges={edges}
          projects={projects}
          selectedId={m.selectedId}
          projectId={m.projectId}
          hoveredId={hoveredId}
          neighbourIds={m.neighbourIds}
          visibleIds={visibleIds}
          onSelect={m.setSelectedId}
          onHover={onHover}
        />
      </div>
    </ErrorBoundary>
  );
}
