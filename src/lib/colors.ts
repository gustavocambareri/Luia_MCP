// Luia Graph — palette
//
// Built from five anchors:
//   Tea Green #BDD9BF · Charcoal Blue #2E4052 · Golden Pollen #FFC857
//   White #FFFFFF · Midnight Violet #412234
//
// Charcoal Blue carries text and the team scope. White and Tea Green mix into
// the warm near-white canvas (#F4F2ED). The categorical hues are derived by
// walking the ramp between Tea Green, Golden Pollen and Midnight Violet, then
// tuned so every hue lands in a 2.9–4.8 contrast band against the canvas —
// close enough that no single project reads as heavier than the others.

// Canvas + ink
export const BG = "#F4F2ED";
export const INK = "#2E4052";

// Text ramp — three steps, all tinted from Charcoal Blue so secondary text
// reads as the same ink at lower emphasis rather than as a separate grey.
// Contrast against the canvas: 9.5 / 4.9 / 3.4. INK_FAINT is the floor and is
// reserved for 10px-and-up metadata; nothing smaller uses it.
export const INK_MUTED = "#5A6B7C";
export const INK_FAINT = "#78868F";

// Scope colors
export const SCOPE_COLORS: Record<string, string> = {
  team: "#2E4052",      // Charcoal Blue
  skills: "#5E8F64",    // Tea Green, deepened
  personal: "#B8862F",  // Golden Pollen, deepened
  root: "#BF5F49",      // Terracotta
};

// Project colors
export const PROJECT_COLORS: Record<string, string> = {
  meridian: "#BF5F49",  // Terracotta
  lumen: "#B8862F",     // Golden Pollen, deepened
  atlas: "#5E8F64",     // Tea Green, deepened
  cadence: "#8C5C74",   // Midnight Violet, lifted
  harbor: "#5A7E96",    // Charcoal Blue, lifted
  verso: "#A2674F",     // Clay
};

// Author colors
export const AUTHOR_COLORS: Record<string, string> = {
  team: "#2E4052",
  gustavo: "#BF5F49",
  gus: "#BF5F49",
  elena: "#B8862F",
  karl: "#5E8F64",
  yuki: "#8C5C74",
};

// Edge type colors
export const EDGE_COLORS: Record<string, string> = {
  reference: "#C3C9CE",
  foundation: "#C3C9CE",
  sibling: "#C3C9CE",
};

export function getNodeColor(scope: string, project?: string): string {
  if (scope === "project" && project) {
    return PROJECT_COLORS[project] || "#2E4052";
  }
  return SCOPE_COLORS[scope] || "#2E4052";
}

export function getAuthorColor(author?: string): string {
  if (!author) return "#2E4052";
  return AUTHOR_COLORS[author.toLowerCase()] || "#2E4052";
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
