import { useCallback, useMemo, useState } from "react";
import type { GraphNode, GraphEdge } from "../lib/types";

export type ScopeKey = "team" | "project";
export const AUTHOR_KEYS = ["GUS", "ELENA", "KARL", "YUKI"] as const;
export const FILTER_KEYS = ["team", "project", ...AUTHOR_KEYS] as const;

/**
 * Owns everything the manifest needs: the query, the filter set, which project
 * section is expanded, which document is open, and the keyboard cursor.
 *
 * The scene is a consumer of this state, not a second source of it — both panes
 * render from the same selection so they can never disagree.
 */
export function useManifest(nodes: GraphNode[], edges: GraphEdge[]) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Set<string>>(() => new Set(FILTER_KEYS));
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of nodes) m.set(n.id, new Set());
    for (const e of edges) {
      m.get(e.source)?.add(e.target);
      m.get(e.target)?.add(e.source);
    }
    return m;
  }, [nodes, edges]);

  const passesFilter = useCallback((n: GraphNode) => {
    const scopeKey: ScopeKey = n.scope === "team" ? "team" : "project";
    if (!active.has(scopeKey)) return false;
    if (n.scope === "team") return true;
    return active.has(n.author.toUpperCase());
  }, [active]);

  const matchesQuery = useCallback((n: GraphNode) => {
    const q = query.trim().toUpperCase();
    if (!q) return true;
    return (n.name + " " + n.author + " " + (n.project ?? "team")).toUpperCase().includes(q);
  }, [query]);

  const visible = useMemo(
    () => nodes.filter(n => passesFilter(n) && matchesQuery(n)),
    [nodes, passesFilter, matchesQuery]
  );

  const isFiltered = active.size !== FILTER_KEYS.length;
  const isSearching = query.trim().length > 0;

  const toggleFilter = useCallback((k: string) => {
    setActive(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
    setCursor(-1);
  }, []);

  const resetFilters = useCallback(() => {
    setActive(new Set(FILTER_KEYS));
    setCursor(-1);
  }, []);

  const toggleSection = useCallback((box: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(box) ? next.delete(box) : next.add(box);
      return next;
    });
    setCursor(-1);
  }, []);

  // While searching every matching section opens, so results are never hidden
  // behind a collapsed header.
  const sectionOpen = useCallback(
    (box: string) => isSearching || openSections.has(box),
    [isSearching, openSections]
  );

  const selected = useMemo(
    () => nodes.find(n => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const neighbourIds = useMemo(
    () => (selectedId ? neighbours.get(selectedId) ?? new Set<string>() : new Set<string>()),
    [neighbours, selectedId]
  );

  // The rows the keyboard walks: visible documents inside open sections, in
  // the order they are painted.
  const walkable = useMemo(
    () => visible.filter(n => sectionOpen(n.project ?? "team")),
    [visible, sectionOpen]
  );

  const moveCursor = useCallback((d: number) => {
    setCursor(c => {
      if (!walkable.length) return -1;
      return Math.max(0, Math.min(walkable.length - 1, c + d));
    });
  }, [walkable]);

  const stepSelection = useCallback((d: number) => {
    if (!selectedId) return;
    const i = walkable.findIndex(n => n.id === selectedId);
    if (i < 0) return;
    const j = i + d;
    if (j < 0 || j >= walkable.length) return;
    setSelectedId(walkable[j].id);
  }, [selectedId, walkable]);

  const canStep = useCallback((d: number) => {
    if (!selectedId) return false;
    const i = walkable.findIndex(n => n.id === selectedId);
    if (i < 0) return false;
    const j = i + d;
    return j >= 0 && j < walkable.length;
  }, [selectedId, walkable]);

  return {
    query, setQuery,
    active, toggleFilter, resetFilters, isFiltered, isSearching,
    visible, walkable,
    sectionOpen, toggleSection, setOpenSections,
    selected, selectedId, setSelectedId,
    projectId, setProjectId,
    neighbourIds, neighbours,
    cursor, setCursor, moveCursor,
    stepSelection, canStep,
  };
}
