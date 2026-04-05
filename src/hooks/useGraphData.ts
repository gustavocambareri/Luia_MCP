import { useMemo, useState, useCallback } from "react";
import type { GraphNode, GraphEdge, GraphData } from "../lib/types";
import rawData from "../data/graph-data.json";

export interface Filters {
  scopes: Set<string>;
  projects: Set<string>;
  authorLens: string | null;
  search: string;
}

export function useGraphData() {
  const [filters, setFilters] = useState<Filters>({
    scopes: new Set(["team", "project", "skills", "personal", "root"]),
    projects: new Set(["museon", "pulse", "solara"]),
    authorLens: null,
    search: "",
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  const fullData: GraphData = useMemo(() => ({
    nodes: rawData.nodes as GraphNode[],
    edges: rawData.edges as GraphEdge[],
  }), []);

  const authors = useMemo(() => {
    const set = new Set<string>();
    fullData.nodes.forEach(n => { if (n.author) set.add(n.author); });
    return Array.from(set);
  }, [fullData]);

  const allProjects = useMemo(() => {
    const set = new Set<string>();
    fullData.nodes.forEach(n => { if (n.project) set.add(n.project); });
    return Array.from(set);
  }, [fullData]);

  // Filtered node IDs
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of fullData.nodes) {
      if (!filters.scopes.has(node.scope)) continue;
      if (node.scope === "project" && node.project && !filters.projects.has(node.project)) continue;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match = node.name.toLowerCase().includes(q) ||
          node.tags.some(t => t.toLowerCase().includes(q)) ||
          node.description.toLowerCase().includes(q) ||
          node.sections.some(s => s.toLowerCase().includes(q));
        if (!match) continue;
      }
      ids.add(node.id);
    }
    return ids;
  }, [fullData, filters]);

  const filteredData = useMemo(() => {
    const nodes = fullData.nodes.filter(n => visibleNodeIds.has(n.id));
    const edges = fullData.edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
    return { nodes, edges };
  }, [fullData, visibleNodeIds]);

  const isNodeDimmed = useCallback((nodeId: string) => {
    if (!filters.authorLens) return false;
    const node = fullData.nodes.find(n => n.id === nodeId);
    return node?.author?.toLowerCase() !== filters.authorLens.toLowerCase();
  }, [filters.authorLens, fullData]);

  // Get edges connected to a specific node
  const getNodeEdges = useCallback((nodeId: string) => {
    return fullData.edges.filter(e => e.source === nodeId || e.target === nodeId);
  }, [fullData]);

  // Get connected nodes for a given node
  const getConnectedNodes = useCallback((nodeId: string) => {
    const edges = getNodeEdges(nodeId);
    const connectedIds = new Set<string>();
    edges.forEach(e => {
      if (e.source === nodeId) connectedIds.add(e.target);
      if (e.target === nodeId) connectedIds.add(e.source);
    });
    return fullData.nodes.filter(n => connectedIds.has(n.id));
  }, [fullData, getNodeEdges]);

  const toggleScope = useCallback((scope: string) => {
    setFilters(prev => {
      const next = new Set(prev.scopes);
      if (next.has(scope)) next.delete(scope); else next.add(scope);
      return { ...prev, scopes: next };
    });
  }, []);

  const toggleProject = useCallback((project: string) => {
    setFilters(prev => {
      const next = new Set(prev.projects);
      if (next.has(project)) next.delete(project); else next.add(project);
      return { ...prev, projects: next };
    });
  }, []);

  const setAuthorLens = useCallback((author: string | null) => {
    setFilters(prev => ({
      ...prev,
      authorLens: prev.authorLens === author ? null : author,
    }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  return {
    fullData,
    filteredData,
    filters,
    authors,
    allProjects,
    selectedNode,
    setSelectedNode,
    selectedEdge,
    setSelectedEdge,
    isNodeDimmed,
    getNodeEdges,
    getConnectedNodes,
    toggleScope,
    toggleProject,
    setAuthorLens,
    setSearch,
  };
}
