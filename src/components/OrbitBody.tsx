import { useEffect, useRef } from "react";
import type { GraphNode, GraphEdge } from "../lib/types";
import { INK, PAPER, bez, clamp, mix, rgb, toneFor, MONO, SANS } from "../lib/theme";

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
  const readoutRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const props = useRef(p); props.current = p;

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
    const st = new Map<string, { open: number; dim: number; hov: number; filt: number; sx: number; sy: number; z: number; lab: number }>();
    props.current.nodes.forEach(n => st.set(n.id, { open: 0, dim: 0, hov: 0, filt: 0, sx: 0, sy: 0, z: 0, lab: 0 }));
    const pst = new Map<string, { wake: number; sx: number; sy: number; z: number }>();
    props.current.projects.forEach(pr => pst.set(pr.id, { wake: 0, sx: 0, sy: 0, z: 0 }));
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

    function project(pt: [number, number, number]) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x = pt[0] * cy - pt[2] * sy, z = pt[0] * sy + pt[2] * cy;
      const y2 = pt[1] * cp - z * sp, z2 = pt[1] * sp + z * cp;
      const R = Math.min(W, H) * 0.40, k = 1 + z2 * 0.08;
      return { x: W / 2 + x * R * k, y: H / 2 + 8 - y2 * R * k, z: z2 };
    }

    function arc3(fn: (t: number) => [number, number, number], steps: number, alpha: number, lw = 1) {
      ctx.lineWidth = lw;
      let prev: { x: number; y: number; z: number } | null = null;
      for (let i = 0; i <= steps; i++) {
        const P = project(fn(i / steps));
        if (prev) {
          const z = (P.z + prev.z) / 2;
          ctx.strokeStyle = rgb(toneFor(z), alpha * (0.45 + 0.55 * clamp((z + 1) / 2, 0, 1)));
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(P.x, P.y); ctx.stroke();
        }
        prev = P;
      }
      ctx.lineWidth = 1;
    }

    function pickNode(x: number, y: number) {
      let best: GraphNode | null = null, bd = 16;
      for (const n of props.current.nodes) {
        const s = st.get(n.id)!;
        if (s.filt > 0.5 || s.z < -0.15) continue;
        const d = Math.hypot(s.sx - x, s.sy - y);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    }

    let dragging = false, moved = 0, lx = 0, ly = 0, downAt = 0;
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
      const n = pickNode(e.clientX - r.left, e.clientY - r.top);
      props.current.onHover(n);
      cv.style.cursor = n ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent) => {
      dragging = false; cv.classList.remove("grabbing");
      if (moved < 6 && Date.now() - downAt < 400) {
        const r = cv.getBoundingClientRect();
        const n = pickNode(e.clientX - r.left, e.clientY - r.top);
        props.current.onSelect(n ? n.id : null);
      }
    };
    const onLeave = () => props.current.onHover(null);
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
      ctx.strokeStyle = rgb(INK, 0.85 * e0); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(C.x, C.y, R, 0, Math.PI * 2 * e0); ctx.stroke(); ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, big = i % 2 === 0;
        ctx.strokeStyle = rgb(INK, 0.9 * e0); ctx.lineWidth = big ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(C.x + Math.cos(a) * (R - (big ? 9 : 5)), C.y + Math.sin(a) * (R - (big ? 9 : 5)));
        ctx.lineTo(C.x + Math.cos(a) * (R + (big ? 9 : 5)), C.y + Math.sin(a) * (R + (big ? 9 : 5)));
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (let j = -2; j <= 2; j++) {
        const ph = j * Math.PI / 6, r = Math.cos(ph), y = Math.sin(ph);
        arc3(u => [Math.cos(u * Math.PI * 2) * r, y, Math.sin(u * Math.PI * 2) * r], 72, 0.16 * e0);
      }
      for (let j = 0; j < 6; j++) {
        const a = j * Math.PI / 6;
        arc3(u => { const th = u * Math.PI * 2; return [Math.cos(th) * Math.cos(a), Math.sin(th), Math.cos(th) * Math.sin(a)]; }, 72, 0.16 * e0);
      }
      arc3(u => [Math.cos(u * Math.PI * 2), 0, Math.sin(u * Math.PI * 2)], 96, 0.34 * e0);

      // orbits
      P.projects.forEach((pr, i) => {
        const o = orbits.get(pr.id)!;
        const e = enter(0.5 + i * 0.22); if (e < 0.01) return;
        const w = pst.get(pr.id)!.wake;
        arc3(u => orbitPoint(o, u * Math.PI * 2 * e + o.phase), 120, (0.30 + 0.40 * w), 1 + 0.5 * w);
      });

      // positions
      P.nodes.forEach(n => {
        const box = n.project ?? "team";
        const o = orbits.get(box)!;
        const pt: [number, number, number] = n.id === "_team/convictions" ? [0, 0, 0] : orbitPoint(o, angle.get(n.id) ?? 0);
        const pr = project(pt);
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
        ctx.setLineDash(on > 0.5 ? [] : [1, 5]); ctx.lineCap = "round";
        ctx.lineWidth = on > 0.5 ? 1 : 0.8;
        ctx.strokeStyle = rgb(toneFor(z), (0.14 - 0.10 * dim + 0.5 * on) * vis * (0.5 + 0.5 * clamp((z + 1) / 2, 0, 1)));
        if (on > 0.01 && on < 0.999 && sel) {
          const src = ed.source === sel ? A : B, dst = src === A ? B : A;
          const g = bez(on);
          ctx.beginPath(); ctx.moveTo(src.sx, src.sy);
          ctx.lineTo(src.sx + (dst.sx - src.sx) * g, src.sy + (dst.sy - src.sy) * g); ctx.stroke();
        } else {
          let x2 = B.sx, y2 = B.sy;
          if (eL < 1) { x2 = A.sx + (B.sx - A.sx) * eL; y2 = A.sy + (B.sy - A.sy) * eL; }
          ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(x2, y2); ctx.stroke();
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

      // project anchors
      const placed: { x: number; y: number; w: number; h: number }[] = [];
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
        ctx.strokeStyle = rgb(col); ctx.fillStyle = rgb(col); ctx.lineWidth = 1 + 0.8 * s.wake;
        ctx.beginPath(); ctx.arc(P2.x, P2.y, rad, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(P2.x, P2.y, rad * 0.3, 0, 7); ctx.fill();
        for (let q = 0; q < 4; q++) {
          const a2 = q * Math.PI / 2 + Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(P2.x + Math.cos(a2) * (rad + 3), P2.y + Math.sin(a2) * (rad + 3));
          ctx.lineTo(P2.x + Math.cos(a2) * (rad + 7 + 4 * s.wake), P2.y + Math.sin(a2) * (rad + 7 + 4 * s.wake));
          ctx.stroke();
        }
        ctx.restore();
        if (front > 0.34) {
          const ly = P2.y - rad - 11;
          ctx.save(); ctx.globalAlpha = al * (0.5 + 0.5 * front);
          ctx.fillStyle = rgb(mix(col, INK, s.wake));
          ctx.font = `600 11px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.letterSpacing = "0.14em";
          ctx.fillText(pr.label, P2.x, ly); ctx.letterSpacing = "0px";
          ctx.font = `8px ${MONO}`; ctx.globalAlpha = al * 0.55; ctx.textBaseline = "top";
          const count = P.nodes.filter(n => (n.project ?? "team") === pr.id).length;
          ctx.fillText(`${String(count).padStart(2, "0")} DOC`, P2.x, ly + 3);
          ctx.restore();
          placed.push({ x: P2.x - 40, y: ly - 14, w: 80, h: 30 });
        }
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
          const r = (3.4 + 1.2 * s.hov + 1.8 * s.open) * (0.6 + 0.4 * front) * e;
          ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = rgb(col);
          ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, 7); ctx.fill();
          if (s.open > 0.01) {
            ctx.strokeStyle = rgb(col, s.open * 0.9); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(s.sx, s.sy, r + 4 + 5 * bez(s.open), 0, 7); ctx.stroke();
          }
          ctx.restore();
        }
        // label
        const lab = n.name.replace(/^[^—]+—\s*/, "").trim().toUpperCase();
        const words = lab.split(" ");
        let l1 = lab, l2 = "";
        if (words.length > 2) { const mid = Math.ceil(words.length / 2); l1 = words.slice(0, mid).join(" "); l2 = words.slice(mid).join(" "); }
        ctx.font = `7.5px ${MONO}`;
        const wd = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 6;
        const ht = l2 ? 24 : 13;
        const pri = (n.id === sel ? 3 : s.open > 0.3 ? 2 : n.id === hov ? 2 : 0) * 10 + front;
        const cands = [[s.sx - wd / 2, s.sy - 9 - ht], [s.sx - wd / 2, s.sy + 8], [s.sx + 8, s.sy - ht / 2], [s.sx - 8 - wd, s.sy - ht / 2]];
        let hit: { x: number; y: number; w: number; h: number } | null = null;
        for (const c of cands) {
          const rc = { x: c[0], y: c[1], w: wd, h: ht };
          if (!placed.some(q => rc.x < q.x + q.w && rc.x + rc.w > q.x && rc.y < q.y + q.h && rc.y + rc.h > q.y)) { hit = rc; break; }
        }
        const want = (pri >= 20) || (front > 0.62 && !sel && !proj) || (!!proj && box === proj && front > 0.4);
        if (want && !hit && pri >= 20) hit = { x: cands[0][0], y: cands[0][1], w: wd, h: ht };
        const target = hit && want ? 1 : 0;
        if (hit && want) placed.push(hit);
        s.lab += (target - s.lab) * (1 - Math.exp(-dt * 5));
        if (hit && s.lab > 0.02) {
          ctx.save(); ctx.globalAlpha = s.lab * al * (0.4 + 0.6 * front);
          ctx.fillStyle = rgb(mix(col, INK, s.open));
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.letterSpacing = "0.08em";
          ctx.fillText(l1, hit.x + wd / 2, hit.y);
          if (l2) ctx.fillText(l2, hit.x + wd / 2, hit.y + 11);
          ctx.letterSpacing = "0px"; ctx.restore();
        }
      });

      // scale bar
      { const x = 30, y = H - 42;
        ctx.strokeStyle = rgb(INK, 0.85); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.moveTo(x + 40, y); ctx.lineTo(x + 92, y);
        ctx.stroke(); ctx.lineWidth = 1; }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const hovered = p.nodes.find(n => n.id === p.hoveredId) ?? null;
  const selected = p.nodes.find(n => n.id === p.selectedId) ?? null;
  const labelOf = (id: string) => p.projects.find(x => x.id === id)?.label ?? "TEAM";

  return (
    <div className="stage">
      <canvas ref={cvRef} />
      <i className="corner a" /><i className="corner b" /><i className="corner c" /><i className="corner d" />
      <div className="hud tl">KNOWLEDGE BODY · FIG_001</div>
      <div className="hud bl">
        <div className="read" ref={readoutRef}>
          {hovered ? `${hovered.name} · ${labelOf(hovered.project ?? "team")} · ${hovered.author.toUpperCase()}` : ""}
        </div>
        <div ref={statusRef}>
          {selected
            ? `${selected.name} · ${p.neighbourIds.size} LINKS`
            : "DRAG TO TURN · CLICK A DOCUMENT · READ ON THE LEFT"}
        </div>
      </div>
      <div className="hud br">{p.nodes.length} DOC · {p.edges.length} LINKS</div>
    </div>
  );
}
