import { useCallback, useEffect, useState } from "react";
import type { GraphNode } from "../lib/types";
import { titleCase } from "../lib/theme";

/** Titles read "Project — Descriptor"; the project already shows in the kicker. */
const shortName = (s: string) => s.replace(/^[^—]+—\s*/, "").trim() || s;

interface Props {
  nodes: GraphNode[];
  projects: { id: string; label: string }[];
  m: ReturnType<typeof import("../hooks/useManifest").useManifest>;
  onHover: (n: GraphNode | null) => void;
}

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline markdown: bold and code only. The bodies are simple by design. */
function inline(t: string) {
  return t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
}

/**
 * Blocks: headings, quotes, lists, pipe tables, paragraphs. Enough for the
 * knowledge store's own Markdown without pulling in a parser.
 */
function renderBody(src: string) {
  // Pull fenced blocks out first: ASCII diagrams and code depend on their
  // line breaks, which the paragraph rules below would collapse.
  const fences: string[] = [];
  const withoutFences = src.replace(/```[\s\S]*?```/g, m => {
    fences.push(m.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""));
    return `\u0000FENCE${fences.length - 1}\u0000`;
  });

  return withoutFences.split(/\n{2,}/).map(raw => {
    const b = raw.trim();
    if (!b) return "";
    const fence = b.match(/^\u0000FENCE(\d+)\u0000$/);
    if (fence) return `<pre>${escapeHtml(fences[Number(fence[1])])}</pre>`;
    // an indented run is also preformatted
    if (/^ {4}|^\t/.test(raw) && !/^[-*] /m.test(b)) return `<pre>${escapeHtml(raw.replace(/^ {4}/gm, ""))}</pre>`;
    if (/^#{1,3} /.test(b)) return `<h3>${inline(b.replace(/^#+ /, ""))}</h3>`;
    if (/^> /.test(b)) return `<blockquote>${inline(b.replace(/^> /gm, ""))}</blockquote>`;
    if (/^[-*] /m.test(b)) {
      const items = b.split("\n").filter(l => /^[-*] /.test(l))
        .map(l => `<li>${inline(l.replace(/^[-*] /, ""))}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    if (/^\|/.test(b)) {
      const rows = b.split("\n")
        .filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l))
        .map(l => l.split("|").slice(1, -1).map(c => c.trim()));
      return `<table class="tbl">${rows.map((r, i) =>
        `<tr>${r.map(c => i ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join("")}</tr>`
      ).join("")}</table>`;
    }
    if (/^-{3,}$/.test(b)) return "";
    return `<p>${inline(b.replace(/\n/g, " "))}</p>`;
  }).join("");
}

export function Reader({ nodes, projects, m, onHover }: Props) {
  const [copied, setCopied] = useState(false);
  const n = m.selected;

  // Copying the raw Markdown is the point of the reader: the body goes
  // straight into a brief or a prompt.
  const copy = useCallback(async () => {
    if (!n) return;
    try {
      await navigator.clipboard.writeText(n.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked; the button simply does not confirm */ }
  }, [n]);

  useEffect(() => { setCopied(false); }, [n?.id]);

  if (!n) return <div className="pane reader" aria-hidden />;

  const projectOf = (x: GraphNode) =>
    projects.find(p => p.id === (x.project ?? "team"))?.label ?? "TEAM";
  const linked = nodes.filter(x => m.neighbourIds.has(x.id));

  return (
    <div className="pane reader">
      <div className="r-top">
        <span className="back" role="button" tabIndex={0}
          onClick={() => m.setSelectedId(null)}
          onKeyDown={e => { if (e.key === "Enter") m.setSelectedId(null); }}>← INDEX</span>
        <span className="r-nav">
          <button onClick={() => m.stepSelection(-1)} disabled={!m.canStep(-1)} title="Previous">↑</button>
          <button onClick={() => m.stepSelection(1)} disabled={!m.canStep(1)} title="Next">↓</button>
        </span>
      </div>

      <div className="r-body" key={n.id}>
        <div className="r-head">
          <div className="r-title">{titleCase(shortName(n.name))}</div>
          <button
            className={`copy${copied ? " done" : ""}`}
            onClick={copy}
            title="Copy document"
            aria-label="Copy document"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>

        <div className="r-line">
          {projectOf(n)} · {n.author.toUpperCase()} · {linked.length} LINK{linked.length === 1 ? "" : "S"}
        </div>

        <div className="prose" dangerouslySetInnerHTML={{ __html: renderBody(n.body) }} />

        {linked.length > 0 && (
          <>
            <div className="r-sec">CONNECTED</div>
            {linked.map(x => (
              <div key={x.id} className="link"
                onClick={() => m.setSelectedId(x.id)}
                onMouseEnter={() => onHover(x)}
                onMouseLeave={() => onHover(null)}>
                <div className="t">{titleCase(shortName(x.name))}</div>
                <div className="a">{projectOf(x)}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
