import { useEffect, useRef } from "react";
import type { GraphNode, GraphEdge } from "../lib/types";
import { CHALK, INK, LINE, PAPER, YELLOW, bez, clamp, mix, rgb, toneFor, MONO, SANS } from "../lib/theme";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  projects: { id: string; label: string }[];
  selectedId: string | null;
  projectId: string | null;
  hoveredId: string | null;
  neighbourIds: Set<string>;
  visibleIds: Set<string>;
  onSelect: (id: string | null) => void;
  onHover: (n: GraphNode | null) => void;
}

interface Orbit { tilt: number; az: number; rad: number; phase: number }

/** A point on a great circle of the body, tilted and spun into place. */
function orbitPoint(o: Orbit, ang: number): [number, number, number] {
  const x = Math.cos(ang) * o.rad, y = Math.sin(ang) * o.rad;
  const ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
  const ca = Math.cos(o.az), sa = Math.sin(o.az);
  const x1 = x, y1 = y * ct, z1 = y * st;
  return [x1 * ca - z1 * sa, y1, x1 * sa + z1 * ca];
}

/**
 * The instrument. Team convictions sit at the centre; every project is one
 * tilted orbit carrying its documents in a short arc, so a project reads as a
 * run of dots in one place rather than a ring around the whole body.
 *
 * Everything here is drawn on a canvas each frame. React owns the selection;
 * this component only reads it, via a ref so the loop never restarts.
 */
export function OrbitBody(p: Props) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const props = useRef(p); props.current = p;

  // Selecting from the list turns the body to that document too, so the two
  // panes always agree about what you are looking at.
  const faceRef = useRef<((n: GraphNode) => void) | null>(null);
  useEffect(() => {
    if (!p.selectedId) return;
    const n = p.nodes.find(x => x.id === p.selectedId);
    if (n) faceRef.current?.(n);
  }, [p.selectedId, p.nodes]);

  useEffect(() => {
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, W = 0, H = 0, DPR = 1;

    const orbits = new Map<string, Orbit>();
    props.current.projects.forEach((proj, i) => {
      orbits.set(proj.id, proj.id === "team"
        ? { tilt: 1.35, az: 0.3, rad: 0.34, phase: 0 }
        : { tilt: 0.55 + ((i - 1) % 3) * 0.42, az: (i - 1) * Math.PI / 3 + 0.4, rad: 1, phase: (i - 1) * 0.7 });
    });

    /** Turn the body so a point ends up facing the viewer. */
    function faceTo(pt: [number, number, number]) {
      const target = Math.atan2(pt[0], pt[2]);
      let d = target - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yawT = yaw + d;
    }

    // Angles are fixed per document so a document never moves between frames.
    const angle = new Map<string, number>();
    const anchorAngle = new Map<string, number>();
    props.current.projects.forEach(proj => {
      const mem = props.current.nodes.filter(n => (n.project ?? "team") === proj.id && n.id !== "_team/convictions");
      const o = orbits.get(proj.id)!;
      anchorAngle.set(proj.id, o.phase);
      mem.forEach((n, j) => {
        const spread = 0.62;
        angle.set(n.id, o.phase + (mem.length > 1 ? (j / (mem.length - 1) - 0.5) * spread : 0));
      });
    });

    // Animated values, eased toward their targets every frame.
    const st = new Map<string, { open: number; dim: number; hov: number; filt: number; sx: number; sy: number; z: number; lab: number; slot: number }>();
    props.current.nodes.forEach(n => st.set(n.id, { open: 0, dim: 0, hov: 0, filt: 0, sx: 0, sy: 0, z: 0, lab: 0, slot: 0 }));
    const pst = new Map<string, { wake: number; sx: number; sy: number; z: number; lab: number; slot: number }>();
    props.current.projects.forEach(pr => pst.set(pr.id, { wake: 0, sx: 0, sy: 0, z: 0, lab: 0, slot: 0 }));
    const est = new Map<string, number>();

    let yaw = 0.4, pitch = 0.28, yawT: number | null = null, yawV = 0, pitchV = 0;
    const T0 = performance.now() / 1000;
    let last = performance.now();

    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    function posOf(n: GraphNode): [number, number, number] {
      if (n.id === "_team/convictions") return [0, 0, 0];
      const o = orbits.get(n.project ?? "team")!;
      return orbitPoint(o, angle.get(n.id) ?? 0);
    }


    function project(pt: [number, number, number]) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x = pt[0] * cy - pt[2] * sy, z = pt[0] * sy + pt[2] * cy;
      const y2 = pt[1] * cp - z * sp, z2 = pt[1] * sp + z * cp;
      const R = Math.min(W, H) * 0.40, k = 1 + z2 * 0.08;
      return { x: W / 2 + x * R * k, y: H / 2 + 8 - y2 * R * k, z: z2 };
    }

    function arc3(fn: (t: number) => [number, number, number], steps: number, alpha: number, lw = 1, tint?: readonly number[], tintAmt = 0) {
      ctx.lineWidth = lw;
      let prev: { x: number; y: number; z: number } | null = null;
      for (let i = 0; i <= steps; i++) {
        const P = project(fn(i / steps));
        if (prev) {
          const z = (P.z + prev.z) / 2;
          const base = tint ? mix(toneFor(z), tint, tintAmt) : toneFor(z);
          ctx.strokeStyle = rgb(base, alpha * (0.45 + 0.55 * clamp((z + 1) / 2, 0, 1)));
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(P.x, P.y); ctx.stroke();
        }
        prev = P;
      }
      ctx.lineWidth = 1;
    }

    // Hit radius is generous and grows toward the front of the body, where the
    // dots are drawn larger. Ties go to whichever dot is nearest the viewer, so
    // a dot on the far side never steals a click from one in front of it.
    function pickNode(x: number, y: number) {
      let best: GraphNode | null = null, bestScore = Infinity;
      for (const n of props.current.nodes) {
        const s = st.get(n.id)!;
        if (s.filt > 0.5) continue;
        const front = clamp((s.z + 1) / 2, 0, 1);
        const hit = 15 + 9 * front;
        const d = Math.hypot(s.sx - x, s.sy - y);
        if (d > hit) continue;
        // prefer the closer pointer distance, then the nearer dot
        const score = d - front * 6;
        if (score < bestScore) { bestScore = score; best = n; }
      }
      return best;
    }

    let dragging = false, moved = 0, lx = 0, ly = 0, downAt = 0;
    // Last known pointer position, so hover stays correct as the body rotates
    // beneath a cursor that has not moved.
    let px = -1e4, py = -1e4, inside = false;
    const onDown = (e: PointerEvent) => {
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; downAt = Date.now();
      cv.classList.add("grabbing"); cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) yawT = null;
        yawV += dx * 0.0022; pitchV += dy * 0.0014;
        lx = e.clientX; ly = e.clientY; return;
      }
      const r = cv.getBoundingClientRect();
      px = e.clientX - r.left; py = e.clientY - r.top; inside = true;
      const n = pickNode(px, py);
      props.current.onHover(n);
      cv.style.cursor = n ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      dragging = false; cv.classList.remove("grabbing");
      if (moved < 6 && Date.now() - downAt < 400) {
        const r = cv.getBoundingClientRect();
        const n = pickNode(e.clientX - r.left, e.clientY - r.top);
        if (n) faceTo(posOf(n));
        props.current.onSelect(n ? n.id : null);
      }
    };
    const onLeave = () => { inside = false; props.current.onHover(null); cv.style.cursor = "grab"; };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onLeave);

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000, T = t - T0;
      const P = props.current;
      const sel = P.selectedId, proj = P.projectId, hov = P.hoveredId;

      // The body slows right down while a document is open: the interface
      // pointing at the reader rather than at itself.
      const slow = sel ? 0.25 : hov ? 0.5 : 1;
      if (yawT !== null) {
        yaw += (yawT - yaw) * (1 - Math.exp(-dt * 3));
        if (Math.abs(yawT - yaw) < 0.002) yawT = null;
      } else yaw += 0.06 * slow * dt;
      yaw += yawV; yawV *= 0.86;
      pitch = clamp(pitch + pitchV, -0.6, 0.9); pitchV *= 0.86;

      const k = 1 - Math.exp(-dt * 6);
      P.nodes.forEach(n => {
        const s = st.get(n.id)!;
        const isSel = sel === n.id, isNb = P.neighbourIds.has(n.id);
        const openT = sel ? (isSel ? 1 : isNb ? 0.6 : 0) : (proj && (n.project ?? "team") === proj ? 0.4 : 0);
        const dimT = sel ? (!isSel && !isNb ? 1 : 0) : (proj && (n.project ?? "team") !== proj ? 0.7 : 0);
        s.open += (openT - s.open) * k;
        s.dim += (dimT - s.dim) * k;
        s.hov += ((hov === n.id ? 1 : 0) - s.hov) * k;
        s.filt += ((P.visibleIds.has(n.id) ? 0 : 1) - s.filt) * k;
      });
      P.projects.forEach(pr => {
        const s = pst.get(pr.id)!;
        const wakeT = sel
          ? ((P.nodes.find(n => n.id === sel)?.project ?? "team") === pr.id ? 1 : 0)
          : (proj === pr.id ? 1 : 0);
        s.wake += (wakeT - s.wake) * (1 - Math.exp(-dt * 4));
      });

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = rgb(PAPER); ctx.fillRect(0, 0, W, H);

      const enter = (t0: number, d = 1.6) => bez((T - t0) / d);
      const e0 = enter(0, 1.8);

      // sphere: rim, ticks, wireframe
      const C = project([0, 0, 0]); const R = Math.min(W, H) * 0.40;
      ctx.strokeStyle = rgb(INK, LINE.rim * e0); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, Math.PI * 2 * e0); ctx.stroke(); ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, big = i % 2 === 0;
        // the four cardinal ticks are the instrument's reference marks, and the
        // only place colour appears at rest
        ctx.strokeStyle = big ? rgb(YELLOW, e0) : rgb(INK, 0.9 * e0);
        ctx.lineWidth = big ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(C.x + Math.cos(a) * (R - (big ? 10 : 5)), C.y + Math.sin(a) * (R - (big ? 10 : 5)));
        ctx.lineTo(C.x + Math.cos(a) * (R + (big ? 10 : 5)), C.y + Math.sin(a) * (R + (big ? 10 : 5)));
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      // The latitude/longitude wireframe is off: the orbits and the rim carry
      // the volume on their own, and the mesh was mostly clutter behind them.
      arc3(u => [Math.cos(u * Math.PI * 2), 0, Math.sin(u * Math.PI * 2)], 96, LINE.equator * e0);

      // orbits
      P.projects.forEach((pr, i) => {
        const o = orbits.get(pr.id)!;
        const e = enter(0.5 + i * 0.22); if (e < 0.01) return;
        const w = pst.get(pr.id)!.wake;
        // an orbit only steps up the tonal ladder when its project is live;
        // the accent stays on the rings so there is one yellow idea, not two
        const a = LINE.orbitIdle + (LINE.orbitWake - LINE.orbitIdle) * w;
        arc3(u => orbitPoint(o, u * Math.PI * 2 * e + o.phase), 120, a, 1 + 0.8 * w);
      });

      // positions
      P.nodes.forEach(n => {
        const pr = project(posOf(n));
        const s = st.get(n.id)!; s.sx = pr.x; s.sy = pr.y; s.z = pr.z;
      });

      // chords, deliberately faint so the documents stay the darkest thing
      const eL = enter(2.2);
      P.edges.forEach((ed, i) => {
        const A = st.get(ed.source), B = st.get(ed.target);
        if (!A || !B) return;
        const vis = (1 - A.filt) * (1 - B.filt) * eL; if (vis < 0.02) return;
        const key = `${ed.source}|${ed.target}|${i}`;
        const onT = sel ? (ed.source === sel || ed.target === sel ? 1 : 0)
          : (proj ? ((P.nodes.find(n => n.id === ed.source)?.project ?? "team") === proj
            || (P.nodes.find(n => n.id === ed.target)?.project ?? "team") === proj ? 1 : 0) : 0);
        const on = (est.get(key) ?? 0) + (onT - (est.get(key) ?? 0)) * (1 - Math.exp(-dt * 3.5));
        est.set(key, on);
        const dim = (sel || proj) && onT === 0 ? 1 : 0;
        const z = (A.z + B.z) / 2;
        const depth = 0.5 + 0.5 * clamp((z + 1) / 2, 0, 1);
        const live = bez(on);

        // At rest a chord is a faint dotted ink hairline, part of the wireframe.
        // When it comes alive it is redrawn in chalk — lighter than the paper —
        // so a live connection reads as a different material rather than as a
        // heavier version of the same line. A thin ink casing underneath keeps
        // it legible where it crosses an orbit.
        ctx.lineCap = "round";
        if (live < 0.02) {
          ctx.setLineDash([1, 5]); ctx.lineWidth = 0.8;
          ctx.strokeStyle = rgb(toneFor(z), (LINE.chord - 0.09 * dim) * vis * depth);
          let x2 = B.sx, y2 = B.sy;
          if (eL < 1) { x2 = A.sx + (B.sx - A.sx) * eL; y2 = A.sy + (B.sy - A.sy) * eL; }
          ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(x2, y2); ctx.stroke();
        } else {
          // the live run grows out from the selected end
          const src = sel && ed.source === sel ? A : sel && ed.target === sel ? B : A;
          const dst = src === A ? B : A;
          const g = sel ? live : 1;
          const ex = src.sx + (dst.sx - src.sx) * g, ey = src.sy + (dst.sy - src.sy) * g;

          ctx.setLineDash([]);
          ctx.lineWidth = 2.6; ctx.strokeStyle = rgb(INK, 0.32 * live * vis * depth);
          ctx.beginPath(); ctx.moveTo(src.sx, src.sy); ctx.lineTo(ex, ey); ctx.stroke();

          ctx.lineWidth = 1.3; ctx.strokeStyle = rgb(CHALK, (0.55 + 0.45 * depth) * live * vis);
          ctx.beginPath(); ctx.moveTo(src.sx, src.sy); ctx.lineTo(ex, ey); ctx.stroke();

          // a bead runs to the far end as the connection draws on
          if (sel && live < 0.995) {
            ctx.fillStyle = rgb(CHALK, live * vis);
            ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, 7); ctx.fill();
          }
        }
      });
      ctx.setLineDash([]); ctx.lineCap = "butt";

      // hub
      {
        const e = enter(0.3), r = 10 * e;
        ctx.strokeStyle = rgb(INK, 0.9); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(C.x, C.y, r, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(C.x + Math.cos(a) * (r + 3), C.y + Math.sin(a) * (r + 3));
          ctx.lineTo(C.x + Math.cos(a) * (r + 13), C.y + Math.sin(a) * (r + 13));
          ctx.stroke();
        }
      }

      // Every label on the body goes through one pass at the end of the frame,
      // ranked by how much attention it deserves right now. Nothing draws its
      // own label inline.
      type LabelReq = { key: string; kind: "doc" | "project"; x: number; y: number; gap: number;
        l1: string; l2: string; front: number; col: readonly number[]; emph: number; rank: number; base: number;
        state: { lab: number; slot: number } };
      const labelReqs: LabelReq[] = [];
      const selNode = sel ? P.nodes.find(n => n.id === sel) ?? null : null;
      const selBox = selNode ? (selNode.project ?? "team") : null;
      const selPos = selNode ? st.get(selNode.id)! : null;
      P.projects.forEach((pr, i) => {
        if (pr.id === "team") return;
        const e = enter(0.5 + i * 0.22 + 0.4); if (e < 0.01) return;
        const o = orbits.get(pr.id)!;
        const pt = orbitPoint(o, anchorAngle.get(pr.id) ?? 0);
        const P2 = project(pt); const s = pst.get(pr.id)!;
        s.sx = P2.x; s.sy = P2.y; s.z = P2.z;
        const front = clamp((P2.z + 1) / 2, 0, 1);
        const col = toneFor(P2.z);
        const dimP = sel ? ((P.nodes.find(n => n.id === sel)?.project ?? "team") === pr.id ? 0 : 0.55)
          : (proj ? (proj === pr.id ? 0 : 0.5) : 0);
        const al = (1 - dimP) * e * (0.45 + 0.55 * front);
        const rad = (7 + 2.5 * s.wake) * (0.65 + 0.35 * front) * e;
        ctx.save(); ctx.globalAlpha = al;
        // the project ring carries the accent: yellow at rest, fuller when live
        // one tint at full strength; only the weight changes when the project is live
        ctx.strokeStyle = rgb(YELLOW); ctx.lineWidth = 1.6 + 1.4 * s.wake;
        ctx.beginPath(); ctx.arc(P2.x, P2.y, rad, 0, 7); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = rgb(col);
        ctx.beginPath(); ctx.arc(P2.x, P2.y, rad * 0.3, 0, 7); ctx.fill();
        ctx.strokeStyle = rgb(col);
        for (let q = 0; q < 4; q++) {
          const a2 = q * Math.PI / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(P2.x + Math.cos(a2) * (rad + 3), P2.y + Math.sin(a2) * (rad + 3));
          ctx.lineTo(P2.x + Math.cos(a2) * (rad + 7 + 4 * s.wake), P2.y + Math.sin(a2) * (rad + 7 + 4 * s.wake));
          ctx.stroke();
        }
        ctx.restore();
        // rank: the selected document's own project sits just under the
        // selection; an explicitly chosen project leads; otherwise by depth
        let rank: number, base: number;
        if (sel) { const own = selBox === pr.id; rank = own ? 800 : 300 + front * 50; base = own ? 0.8 : 0.2; }
        else if (proj) { const own = proj === pr.id; rank = own ? 900 : 300 + front * 50; base = own ? 1 : 0.28; }
        else { rank = 500 + front * 100; base = 0.9 * (0.5 + 0.5 * front); }
        if (front > 0.2) labelReqs.push({ key: "p:" + pr.id, kind: "project", x: P2.x, y: P2.y, gap: rad + 4,
          l1: pr.label, l2: "", front, col, emph: s.wake, rank, base: base * e, state: s });
      });

      // documents, back to front, with labels that never overlap
      [...P.nodes].sort((a, b) => st.get(a.id)!.z - st.get(b.id)!.z).forEach(n => {
        const s = st.get(n.id)!;
        if (s.filt > 0.98) return;
        const box = n.project ?? "team";
        const pi = P.projects.findIndex(x => x.id === box);
        const e = enter(0.5 + pi * 0.22 + 0.6); if (e < 0.01) return;
        const front = clamp((s.z + 1) / 2, 0, 1);
        const col = toneFor(s.z);
        const al = (1 - 0.7 * s.dim) * (1 - s.filt) * e;
        if (n.id !== "_team/convictions") {
          const r = (4.2 + 1.6 * s.hov + 2 * s.open) * (0.55 + 0.45 * front) * e;
          const far = front < 0.5;
          ctx.save(); ctx.globalAlpha = al * (far ? 0.75 : 1);
          if (far) {
            // behind the equator: drawn hollow, so it is obvious the document
            // is on the far side and a click will turn the body to reach it
            ctx.strokeStyle = rgb(col); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, 7); ctx.stroke();
          } else {
            ctx.fillStyle = rgb(col);
            ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, 7); ctx.fill();
          }
          // hovering opens a ring at the size of the actual hit area, so the
          // target you can click is the target you can see
          if (s.hov > 0.01) {
            const hv = bez(s.hov);
            ctx.strokeStyle = rgb(col, hv * 0.75); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(s.sx, s.sy, r + 4 + 7 * hv, 0, 7); ctx.stroke();
            // four ticks, so it reads as a sight rather than a halo
            for (let q = 0; q < 4; q++) {
              const a2 = q * Math.PI / 2 + Math.PI / 4;
              const r0 = r + 6 + 7 * hv, r1 = r0 + 3.5 * hv;
              ctx.beginPath();
              ctx.moveTo(s.sx + Math.cos(a2) * r0, s.sy + Math.sin(a2) * r0);
              ctx.lineTo(s.sx + Math.cos(a2) * r1, s.sy + Math.sin(a2) * r1);
              ctx.stroke();
            }
          }
          if (s.open > 0.01) {
            ctx.strokeStyle = rgb(col, s.open * 0.9); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(s.sx, s.sy, r + 5 + 6 * bez(s.open), 0, 7); ctx.stroke();
          }
          ctx.restore();
        }
        // label request
        const lab = n.name.replace(/^[^—]+—\s*/, "").trim().toUpperCase();
        const words = lab.split(" ");
        let l1 = lab, l2 = "";
        if (words.length > 2) { const mid = Math.ceil(words.length / 2); l1 = words.slice(0, mid).join(" "); l2 = words.slice(mid).join(" "); }
        const isSel = n.id === sel, isHov = n.id === hov, isNb = !!sel && P.neighbourIds.has(n.id);
        let rank: number, base: number;
        if (sel) {
          if (isSel) { rank = 1000; base = 1; }
          else if (isHov) { rank = 900; base = 0.9; }
          else if (isNb) { rank = 600 + front * 50; base = 0.62 * (0.55 + 0.45 * front); }
          else { rank = 0; base = 0; }
        } else if (proj) {
          if (isHov) { rank = 900; base = 0.95; }
          else if (box === proj) { rank = 700 + front * 50; base = 0.85 * (0.5 + 0.5 * front); }
          else { rank = 0; base = 0; }
        } else {
          if (isHov) { rank = 900; base = 1; }
          else { rank = front * 100; base = clamp((front - 0.45) / 0.4, 0, 1); }
        }
        if (base > 0) labelReqs.push({ key: "d:" + n.id, kind: "doc", x: s.sx, y: s.sy, gap: (n.id === "_team/convictions" ? 16 : 9),
          l1, l2, front, col, emph: s.open, rank, base: base * al, state: s });
      });

      // ---- the label pass ----
      // Highest rank places first and owns its space. Every later label picks
      // the slot that collides least with what is already there, then fades by
      // how much it still overlaps. With a selection, a focus zone around the
      // selected document pushes every other label away so the one you chose
      // has air around it. Labels that lose their turn ease out; they never pop.
      labelReqs.sort((a, b) => b.rank - a.rank);
      const placed: { x: number; y: number; w: number; h: number; a: number }[] = [];
      // the marks themselves are obstacles: a label must not sit on an anchor,
      // the hub, or the open document's ring
      P.projects.forEach(pr => { if (pr.id === "team") return; const s = pst.get(pr.id)!;
        const r = 12 + 5 * s.wake; placed.push({ x: s.sx - r, y: s.sy - r, w: r * 2, h: r * 2, a: 1 }); });
      { const r = 26; placed.push({ x: C.x - r, y: C.y - r, w: r * 2, h: r * 2, a: 1 }); }
      if (selPos) { const r = 16; placed.push({ x: selPos.sx - r, y: selPos.sy - r, w: r * 2, h: r * 2, a: 1 }); }
      const seen = new Set<string>();
      for (const L of labelReqs) {
        seen.add(L.key);
        const isDoc = L.kind === "doc";
        ctx.font = isDoc ? `7.5px ${MONO}` : `600 11px ${SANS}`;
        ctx.letterSpacing = isDoc ? "0.08em" : "0.14em";
        const wd = Math.max(ctx.measureText(L.l1).width, ctx.measureText(L.l2).width) + 6;
        const ht = L.l2 ? 24 : (isDoc ? 13 : 15);
        const g = L.gap;
        const cands = isDoc
          ? [[L.x - wd / 2, L.y - g - ht], [L.x - wd / 2, L.y + g], [L.x + g, L.y - ht / 2], [L.x - g - wd, L.y - ht / 2]]
          : [[L.x - wd / 2, L.y - g - ht - 4], [L.x - wd / 2, L.y + g + 4], [L.x + g + 4, L.y - ht / 2], [L.x - g - 4 - wd, L.y - ht / 2]];
        // Score every slot, then keep the one this label already uses unless a
        // different one is clearly better. Without that hysteresis a label sits
        // on the boundary between two slots and swaps every frame, which reads
        // as flicker.
        const scores = cands.map(c => {
          const rc = { x: c[0], y: c[1], w: wd, h: ht };
          let worst = 0;
          for (const q of placed) {
            const ox = Math.min(rc.x + rc.w, q.x + q.w) - Math.max(rc.x, q.x);
            const oy = Math.min(rc.y + rc.h, q.y + q.h) - Math.max(rc.y, q.y);
            if (ox > 0 && oy > 0) worst = Math.max(worst, (ox * oy) / (rc.w * rc.h) * q.a);
          }
          return { rc, worst };
        });
        const prev = L.state.slot ?? 0;
        let best = prev;
        for (let i = 0; i < scores.length; i++) {
          if (scores[i].worst + 0.18 < scores[best].worst) best = i;   // must beat the incumbent by a clear margin
        }
        L.state.slot = best;
        const hit = scores[best].rc, clash = scores[best].worst;

        let alpha = L.base * clamp(1 - clash * 1.7, 0, 1);
        // focus zone: everything but the selection itself yields to it
        if (selPos && L.key !== "d:" + sel) {
          const d = Math.hypot(hit.x + wd / 2 - selPos.sx, hit.y + ht / 2 - selPos.sy);
          const near = clamp((d - 30) / 70, 0, 1);            // 0 inside 30px, 1 beyond 100px
          const soft = near * near * (3 - 2 * near);
          alpha *= L.rank >= 600 ? 0.25 + 0.75 * soft : soft;  // neighbours keep a little presence
        }
        if (alpha > 0.12) placed.push({ ...hit, a: alpha });
        const st_ = L.state; st_.lab += (alpha - st_.lab) * (1 - Math.exp(-dt * 6));
        if (st_.lab > 0.02) {
          ctx.save(); ctx.globalAlpha = st_.lab;
          ctx.fillStyle = rgb(mix(L.col, INK, L.emph));
          ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(L.l1, hit.x + wd / 2, hit.y);
          if (L.l2) ctx.fillText(L.l2, hit.x + wd / 2, hit.y + 11);
          ctx.restore();
        }
      }
      ctx.letterSpacing = "0px";
      // labels that got no request this frame ease out rather than vanish
      P.nodes.forEach(n => { if (!seen.has("d:" + n.id)) { const s = st.get(n.id)!; s.lab += (0 - s.lab) * (1 - Math.exp(-dt * 6)); } });
      P.projects.forEach(pr => { if (!seen.has("p:" + pr.id)) { const s = pst.get(pr.id)!; s.lab += (0 - s.lab) * (1 - Math.exp(-dt * 6)); } });

      // corner ornaments: a small yellow square inside each frame corner,
      // the instrument's registration marks
      { const m = 26, sq = 4;
        ctx.fillStyle = rgb(YELLOW);
        [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(([cx2, cy2]) => {
          ctx.fillRect(cx2 - sq / 2, cy2 - sq / 2, sq, sq);
        }); }


      // re-test hover against the new positions
      if (inside && !dragging) {
        const n = pickNode(px, py);
        if ((n?.id ?? null) !== props.current.hoveredId) props.current.onHover(n);
        cv.style.cursor = n ? "pointer" : "grab";
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    faceRef.current = (n: GraphNode) => faceTo(posOf(n));

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
    };
  }, []);


  return (
    <div className="stage">
      <canvas ref={cvRef} />
      <i className="corner a" /><i className="corner b" /><i className="corner c" /><i className="corner d" />
    </div>
  );
}
