// Coaching test (V3.10): the runout planner, three balls ahead. On the balls at rest (inches, P from core.js makeP): the ball
// to shoot (the lowest), the next and the one after. For the next ball, every spot of the table is graded as a place for the
// cue ball to shoot it from, for the pocket a player would choose: green (makeable with an angle, and the cue ball can be
// sent on to a good shot on the ball after), red (makeable, but the cue ball heads away from the ball after: the wrong side),
// grey (a ball in the way). The shot on the lowest ball from where the cue ball is, the stroke that brings the cue ball into
// that green, and from the zone's best spot the stroke on to the ball after. The cue ball after contact: 5/7 of the sliding
// speed along the tangent line plus 2/7 of the follow or draw along the shot line (standard cue-ball physics; with a natural
// roll at a half-ball hit, the 30-degree rule). Pure functions; tested in tests/coach.test.js.
// coachFactory: the whole planner in one function, so the app can also run it in a background worker (its source text)
function coachFactory() {
  const D2R = Math.PI / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]), unit = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; }, dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  function segDist(p, a, b) { const d = sub(b, a), l2 = dot(d, d), t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]); }

  function plan(balls, P, opts) {
    const o0 = Object.assign({ step: 1.5, maxLen: 80 }, opts || {}), t0 = Date.now();
    const R = P.R, L = P.L, W = P.W, STEP = o0.step;
    // objs: every ball but the cue ball (in the way); ord: the numbered ones in order (an unnamed ball comes as n 100 and up)
    const cue = balls.find(b => b.n === 0), objs = balls.filter(b => b.n !== 0), ord = objs.filter(b => b.n > 0 && b.n < 100).sort((a, b) => a.n - b.n);
    if (!cue || !ord.length) return null;
    const [A, B, C] = ord, pt = b => [b.x, b.y];
    const blockers = (a, b, skip) => objs.filter(o => !skip.includes(o.n) && segDist(pt(o), a, b) < 2 * R - 0.05);
    // the pockets a ball can go into: lane clear, and the pocket takes it from that side
    function pocketsFor(T, gone) {
      const out = [];
      P.pockets.forEach((pk, pi) => {
        const v = sub([pk.x, pk.y], pt(T)), vl = len(v); if (vl < 0.5) return;
        if (blockers(pt(T), [pk.x, pk.y], [T.n, ...gone]).length) return;
        const nx = pk.corner ? (pk.x < L / 2 ? -1 : 1) / Math.SQRT2 : 0, ny = pk.corner ? (pk.y < W / 2 ? -1 : 1) / Math.SQRT2 : (pk.y < W / 2 ? -1 : 1);
        const entry = Math.acos(Math.max(-1, Math.min(1, (v[0] * nx + v[1] * ny) / vl))) / D2R;
        if (entry > (pk.corner ? 55 : 45)) return;
        out.push({ pi, pk, u: unit(v), dist: vl });
      });
      return out;
    }
    // a shot from X on ball T into pocket o: cut, ghost ball, balls in the way, how easy (0..1)
    function shot(X, T, o, gone) {
      const G = [T.x - 2 * R * o.u[0], T.y - 2 * R * o.u[1]], aim = sub(G, X), dl = len(aim);
      if (dl < 2.2 * R) return null;
      const v = unit(aim), cut = Math.acos(Math.max(-1, Math.min(1, dot(v, o.u)))) / D2R; if (cut > 70) return null;
      const ease = Math.cos(cut * D2R) ** 1.5 / (1 + (dl / 40) ** 1.3 + (o.dist / 45) ** 1.3) * (o.pk.corner ? 1 : 0.85);
      return { G, v, cut, dl, ease, blk: blockers(X, G, [T.n, ...gone]) };
    }
    function trace(p0, d0, ignore) {
      let p = p0.slice(), d = d0.slice(), left = o0.maxLen, bounces = 0; const pts = [p.slice()];
      while (left > 0 && bounces <= 2) {
        p = [p[0] + d[0], p[1] + d[1]]; left -= 1;
        if (p[0] < R) { p[0] = 2 * R - p[0]; d[0] = -d[0]; bounces++; left -= 6; } if (p[0] > L - R) { p[0] = 2 * (L - R) - p[0]; d[0] = -d[0]; bounces++; left -= 6; }
        if (p[1] < R) { p[1] = 2 * R - p[1]; d[1] = -d[1]; bounces++; left -= 6; } if (p[1] > W - R) { p[1] = 2 * (W - R) - p[1]; d[1] = -d[1]; bounces++; left -= 6; }
        if (P.pockets.some(pk => Math.hypot(pk.x - p[0], pk.y - p[1]) < pk.r + 0.3)) { pts.push(p.slice()); pts.scratch = true; break; }
        if (objs.some(q => !ignore.includes(q.n) && Math.hypot(q.x - p[0], q.y - p[1]) < 2 * R)) break;
        pts.push(p.slice());
      }
      return pts;
    }
    function exits(s, o, ignore) {
      const sn = Math.sin(s.cut * D2R), t0v = [s.v[0] - dot(s.v, o.u) * o.u[0], s.v[1] - dot(s.v, o.u) * o.u[1]], t = len(t0v) > 1e-6 ? unit(t0v) : [0, 0], out = [];
      for (let sp = -1.5; sp <= 1.21; sp += 0.225) {
        const w = [5 / 7 * sn * t[0] + 2 / 7 * sp * s.v[0], 5 / 7 * sn * t[1] + 2 / 7 * sp * s.v[1]], vf = len(w); if (vf < 0.04) continue;
        out.push({ kind: sp < -0.1 ? 'draw' : sp > 0.1 ? 'follow' : 'stun', s: +sp.toFixed(2), vf, pts: trace(s.G, unit(w), ignore) });
      }
      return out;
    }
    const spinF = r => r.kind === 'stun' ? 1 : r.kind === 'follow' ? (r.s <= 1.05 ? 0.97 : 0.85) : 1 - Math.abs(r.s) / 3;
    const speedF = (r, d) => { const q = Math.sqrt(d / 40) / (r.vf / 0.5); return q <= 1.6 ? 1 : Math.exp(-(q - 1.6) * 1.2); };
    // the grid of cue-ball spots (not on a ball)
    const nx = Math.floor((L - 2 * R) / STEP), ny = Math.floor((W - 2 * R) / STEP), cx = i => R + (i + 0.5) * STEP, cy = j => R + (j + 0.5) * STEP;
    const idx = p => { const i = Math.floor((p[0] - R) / STEP), j = Math.floor((p[1] - R) / STEP); return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i; };
    const free = (x, y) => !objs.some(o => Math.hypot(o.x - x, o.y - y) < 2 * R);
    // position on C from each spot (A and B gone)
    let cAt = () => 1, cDir = () => null;
    if (C) {
      const pC = pocketsFor(C, [A.n, B.n]), cv = new Float32Array(nx * ny), cu = new Array(nx * ny); let cBest = 1e-6;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const X = [cx(i), cy(j)]; if (!free(X[0], X[1])) continue; let b = 0, u = null;
        for (const o of pC) { const s = shot(X, C, o, [A.n, B.n]); if (s && !s.blk.length && s.cut <= 60 && s.ease > b) { b = s.ease; u = o.u; } }
        cv[j * nx + i] = b; cu[j * nx + i] = u; if (b > cBest) cBest = b;
      }
      cAt = p => { const k = idx(p); return k < 0 ? 0 : cv[k] / cBest; }; cDir = p => { const k = idx(p); return k < 0 ? null : cu[k]; };
    }
    // a cue-ball path's value for the ball after: how much of it runs through good spots for it, more when along that ball's
    // line than across it (the fat part of the zone), less the further it goes and for a harder stroke; full at 14 in
    function pathValue(r) {
      let g = 0;
      for (let i = 3; i < r.pts.length; i++) {
        const c = cAt(r.pts[i]); if (c < 0.55) continue;
        const d = unit(sub(r.pts[i], r.pts[i - 1])), u = cDir(r.pts[i]), along = u ? 0.55 + 0.45 * Math.abs(dot(d, u)) : 0.55;
        g += c * along * Math.exp(-i / 70) * speedF(r, i);
      }
      return Math.min(1, g * spinF(r) / 14);
    }
    const out = { order: ord.map(o => o.n), A: { n: A.n, pocket: null }, B: B ? { n: B.n, pocket: null } : null, C: C ? { n: C.n, pocket: null } : null, step: STEP, nx, ny, origin: [R, R], cells: null, path: null, spot: null, route: null };
    const pA = pocketsFor(A, []);
    const easiestA = () => { let best = null; for (const o of pA) { const s = shot(pt(cue), A, o, []); if (s && !s.blk.length && s.cut <= 70 && (!best || s.ease > best.e)) best = { e: s.ease, pi: o.pi }; } return best ? best.pi : pA.length ? pA[0].pi : null; };
    if (!B) { out.A.pocket = easiestA(); out.ms = Date.now() - t0; return out; }
    // B's zone, for each of its pockets; keep the pocket with the biggest, best zone
    const pB = pocketsFor(B, [A.n]); let bestZ = null;
    for (const o of pB) {
      const g = new Int8Array(nx * ny), sc = new Float32Array(nx * ny); let n = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const X = [cx(i), cy(j)]; if (!free(X[0], X[1])) continue;
        const s = shot(X, B, o, [A.n]); if (!s) continue;
        if (s.blk.length) { g[j * nx + i] = 4; continue; } // grey: in the way
        if (s.cut > 60) continue;
        let posC = 1; if (C) { posC = 0; for (const r of exits(s, o, [A.n, B.n])) { if (r.pts.scratch) continue; const v = pathValue(r); if (v > posC) posC = v; } }
        const angle = s.cut < 6 ? 0.55 : s.cut < 12 ? 0.8 : s.cut <= 40 ? 1 : 0.75;
        const rd = Math.min(X[0], L - X[0], X[1], W - X[1]), rail = rd < 2.5 ? 0.55 : rd < 4.5 ? 0.85 : 1;
        const v = Math.min(1, s.ease / 0.6) * angle * rail * (0.25 + 0.75 * posC);
        sc[j * nx + i] = v; g[j * nx + i] = C && posC < 0.12 ? 3 : 9; n++; // 3 red; 9 graded below
      }
      const worth = Array.from(sc).sort((a, b) => b - a).slice(0, Math.round(150 / (STEP * STEP))).reduce((a, b) => a + b, 0);
      if (!bestZ || worth > bestZ.worth) bestZ = { o, g, sc, worth };
    }
    if (!bestZ) { out.A.pocket = easiestA(); out.ms = Date.now() - t0; return out; }
    const top = Math.max(...bestZ.sc) || 1;
    for (let k = 0; k < nx * ny; k++) if (bestZ.g[k] === 9) { const r = bestZ.sc[k] / top; bestZ.g[k] = r >= 0.62 ? 1 : r >= 0.38 ? 2 : 0; } // 1 green, 2 amber
    // one smoothing pass (the grid samples the zone's edges unevenly): a yellow spot ringed by green is green, a lone green spot yellow
    { const g0 = bestZ.g.slice(), at = (i, j) => i < 0 || j < 0 || i >= nx || j >= ny ? 0 : g0[j * nx + i];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (g0[k] !== 1 && g0[k] !== 2) continue; let n1 = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && at(i + di, j + dj) === 1) n1++;
        if (g0[k] === 2 && n1 >= 5) bestZ.g[k] = 1; else if (g0[k] === 1 && n1 <= 1) bestZ.g[k] = 2; } }
    out.cells = bestZ.g; out.B.pocket = bestZ.o.pi;
    // A: the pocket and stroke that bring the cue ball into the green, rolling through it (room for speed error)
    let pl = null;
    for (const o of pA) {
      const s = shot(pt(cue), A, o, []); if (!s || s.blk.length || s.cut > 60) continue;
      for (const r of exits(s, o, [A.n])) {
        if (r.pts.scratch) continue; let inG = 0, first = -1, last = -1;
        r.pts.forEach((q, i) => { const k = idx(q); if (k >= 0 && bestZ.g[k] === 1) { if (first < 0) first = i; inG++; last = i; } });
        if (!inG) continue;
        const val = Math.min(inG * STEP, 16) * (s.ease / 0.6) * spinF(r) * Math.exp(-first / 40) * speedF(r, (first + last) / 2);
        if (!pl || val > pl.val) pl = { val, pocket: o.pi, cut: Math.round(s.cut), kind: r.kind, s: r.s, ghost: s.G, pts: r.pts.slice(0, Math.round((first + last) / 2) + 1) };
      }
    }
    out.A.pocket = pl ? pl.pocket : easiestA();
    if (pl) out.path = { ghost: pl.ghost, pts: pl.pts, kind: pl.kind, s: pl.s, cut: pl.cut };
    // the zone's spot the plan aims for, the shot on B from there and where the cue ball goes on to for C
    const greens = []; for (let k = 0; k < nx * ny; k++) if (bestZ.g[k] === 1) greens.push([cx(k % nx), cy(Math.floor(k / nx)), bestZ.sc[k]]);
    let sp = null;
    if (pl) { // the best-graded spot within 6 in of where the planned path stops, inside the green
      const m = pl.pts[pl.pts.length - 1], d = q => Math.hypot(q[0] - m[0], q[1] - m[1]), inner = q => { const i = Math.floor((q[0] - R) / STEP), j = Math.floor((q[1] - R) / STEP); return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const ii = i + a, jj = j + b; return ii >= 0 && jj >= 0 && ii < nx && jj < ny && bestZ.g[jj * nx + ii] === 1; }); };
      const close = greens.filter(q => d(q) <= 6 && inner(q)); sp = close.length ? close.sort((a, b) => b[2] - a[2])[0] : greens.sort((a, b) => d(a) - d(b))[0]; }
    else sp = greens.sort((a, b) => b[2] - a[2])[0];
    if (sp) {
      const X = [sp[0], sp[1]], s2 = shot(X, B, bestZ.o, [A.n]); out.spot = X; out.B.cut = Math.round(s2.cut);
      if (C) {
        let br = null, bv = -1; for (const r of exits(s2, bestZ.o, [A.n, B.n])) { if (r.pts.scratch) continue; const v = pathValue(r); if (v > bv) { bv = v; br = r; } }
        if (br) {
          let stop = 3, sv = -1; br.pts.forEach((q, i) => { if (i < 3) return; const v = cAt(q) * Math.exp(-i / 70) * speedF(br, i); if (v > sv) { sv = v; stop = i; } });
          out.route = { ghost: s2.G, pts: br.pts.slice(0, stop + 1), kind: br.kind, s: br.s };
          const end = br.pts[stop]; let cl = null;
          for (const o of pocketsFor(C, [A.n, B.n])) { const s3 = shot(end, C, o, [A.n, B.n]); if (s3 && !s3.blk.length && (!cl || s3.ease > cl.e)) cl = { e: s3.ease, pi: o.pi, cut: Math.round(s3.cut) }; }
          if (cl) { out.C.pocket = cl.pi; out.C.cut = cl.cut; }
        }
      }
    }
    if (C && out.C.pocket == null) { const pC = pocketsFor(C, [A.n, B.n]); if (pC.length) out.C.pocket = pC.sort((a, b) => a.dist - b.dist)[0].pi; }
    out.shapes = shapes(out, B);
    out.ms = Date.now() - t0;
    return out;
  }
  // The zones as straight-edged shapes for drawing (owner, Nov 9: natural straight lines, not squares): each area's connected
  // pieces of cells, and round them the convex outline of the cells' corners. Green: the piece holding the spot, with the
  // pieces near it; red: its biggest piece; in the way: each piece. In table inches.
  function hull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function pieces(pl, want) {
    const { nx, ny, step, origin, cells } = pl, seen = new Uint8Array(cells.length), out = [];
    for (let k = 0; k < cells.length; k++) {
      if (seen[k] || cells[k] !== want) continue; const q = [k], ks = []; seen[k] = 1;
      while (q.length) { const c = q.pop(); ks.push(c); const i = c % nx, j = Math.floor(c / nx);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, n = b * nx + a; if (a < 0 || b < 0 || a >= nx || b >= ny || seen[n] || cells[n] !== want) continue; seen[n] = 1; q.push(n); } }
      const corners = []; for (const c of ks) { const x = origin[0] + (c % nx) * step, y = origin[1] + Math.floor(c / nx) * step; corners.push([x, y], [x + step, y], [x, y + step], [x + step, y + step]); }
      const cx0 = corners.reduce((a, p) => a + p[0], 0) / corners.length, cy0 = corners.reduce((a, p) => a + p[1], 0) / corners.length;
      out.push({ n: ks.length, ks, poly: hull(corners), c: [cx0, cy0] });
    }
    return out;
  }
  function shapes(pl, B) {
    if (!pl.cells) return null;
    const keyOf = p => { const i = Math.floor((p[0] - pl.origin[0]) / pl.step), j = Math.floor((p[1] - pl.origin[1]) / pl.step); return j * pl.nx + i; };
    const g = pieces(pl, 1).filter(q => q.n >= 3);
    let main = pl.spot ? g.find(q => q.ks.includes(keyOf(pl.spot))) : null; if (!main) main = g.sort((a, b) => b.n - a.n)[0];
    const near = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) < 14;
    const gp = main ? g.filter(q => q === main || (q.n >= 6 && near(q, main))) : [], green = gp.length ? [hull([].concat(...gp.map(q => q.poly)))] : []; // one shape
    const red = pieces(pl, 3).sort((a, b) => b.n - a.n).slice(0, 1).filter(q => q.n >= 6).map(q => q.poly);
    const blocked = pieces(pl, 4).filter(q => q.n >= 6).map(q => q.poly);
    // how far the green reaches from the next ball (for the fade: strongest near the ball, lighter further away)
    let far = 0; for (const poly of green) for (const p of poly) far = Math.max(far, Math.hypot(p[0] - B.x, p[1] - B.y));
    return { green, red, blocked, from: [B.x, B.y], far };
  }
  // the grade of a cue-ball spot in a plan's zone: 'green' | 'amber' | 'red' | 'blocked' | null
  function gradeAt(pl, x, y) {
    if (!pl || !pl.cells) return null; const i = Math.floor((x - pl.origin[0]) / pl.step), j = Math.floor((y - pl.origin[1]) / pl.step);
    if (i < 0 || j < 0 || i >= pl.nx || j >= pl.ny) return null; return ({ 1: 'green', 2: 'amber', 3: 'red', 4: 'blocked' })[pl.cells[j * pl.nx + i]] || null;
  }
  return { plan, gradeAt };
}
const COACH = coachFactory();
if (typeof module !== 'undefined') module.exports = COACH;
