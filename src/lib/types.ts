export interface GraphNode {
  id: string;
  name: string;
  slug: string;
  scope: "team" | "project" | "skills" | "personal" | "root";
  project?: string;
  author: string;
  tags: string[];
  created?: string;
  fileSize: number;
  description: string;
  body: string;
  sections: string[];
  connections: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "reference" | "foundation" | "sibling";
  label: string;
  description: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
