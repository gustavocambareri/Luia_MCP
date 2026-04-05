// Pierre Graph — Muted ethereal palette
// Warm red #E85D5D | Amber #D4A843 | Sage #4CAF7D | Steel #7B8FA3
// Background: #F0F0F0 | Text: #2D3748

// Scope colors
export const SCOPE_COLORS: Record<string, string> = {
  team: "#7B8FA3",      // Steel
  skills: "#4CAF7D",    // Sage
  personal: "#D4A843",  // Amber
  root: "#E85D5D",      // Warm red
};

// Project colors
export const PROJECT_COLORS: Record<string, string> = {
  museon: "#E85D5D",    // Warm red
  pulse: "#D4A843",     // Amber
  solara: "#4CAF7D",    // Sage
};

// Author colors
export const AUTHOR_COLORS: Record<string, string> = {
  team: "#7B8FA3",
  gustavo: "#E85D5D",
  gus: "#E85D5D",
  elena: "#D4A843",
  karl: "#4CAF7D",
  yuki: "#7B8FA3",
};

// Edge type colors
export const EDGE_COLORS: Record<string, string> = {
  reference: "#C5CED6",
  foundation: "#C5CED6",
  sibling: "#C5CED6",
};

export function getNodeColor(scope: string, project?: string): string {
  if (scope === "project" && project) {
    return PROJECT_COLORS[project] || "#7B8FA3";
  }
  return SCOPE_COLORS[scope] || "#7B8FA3";
}

export function getAuthorColor(author?: string): string {
  if (!author) return "#7B8FA3";
  return AUTHOR_COLORS[author.toLowerCase()] || "#7B8FA3";
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
