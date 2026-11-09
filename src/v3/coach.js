// Coaching test (V3.10): the runout planner, three balls ahead. On the balls at rest (inches, P from core.js makeP): the ball
// to shoot (the lowest), the next and the one after. For the next ball, every spot of the table is graded as a place for the
// cue ball to shoot it from, for the pocket a player would choose: green (makeable with an angle, and the cue ball can be
// sent on to a good shot on the ball after), red (makeable, but the cue ball heads away from the ball after: the wrong side),
// grey (a ball in the way). The shot on the lowest ball from where the cue ball is, the stroke that brings the cue ball into
// that green, and from the zone's best spot the stroke on to the ball after. The cue ball after contact: 5/7 of the sliding
// speed along the tangent line plus 2/7 of the follow or draw along the shot line (standard cue-ball physics; with a natural
// roll at a half-ball hit, the 30-degree rule). Pure functions; tested in tests/coach.test.js.
// coachFactory: the whole planner in one function, so the app can also run it in a background worker (its source text)
function coachFactory(sim) {
  const D2R = Math.PI / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]), unit = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; }, dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  function segDist(p, a, b) { const d = sub(b, a), l2 = dot(d, d), t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]); }

  function plan(balls, P, opts) {
    const o0 = Object.assign({ step: 1.5, maxLen: 80 }, opts || {}), t0 = Date.now();
    const R = P.R, L = P.L, W = P.W, STEP = o0.step;
    // objs: every ball but the cue ball (in the way); ord: the numbered ones in order (an unnamed ball comes as n 100 and up)
    const cue0 = balls.find(b => b.n === 0), objs = balls.filter(b => b.n !== 0), ord = objs.filter(b => b.n > 0 && b.n < 100).sort((a, b) => a.n - b.n);
    // ball in hand (after a scratch, V3.11): no cue ball on the table; the plan puts it where the shot on the lowest ball
    // gets on to the next (the zone is then the lowest ball's)
    const inHand = !cue0 && !!o0.inHand; if ((!cue0 && !inHand) || !ord.length) return null;
    const cue = cue0 || { n: 0, x: -99, y: -99 };
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
    // in hand the zone is the lowest ball's, with the next after it; otherwise the next ball's, with the one after
    const Zb = inHand ? A : B, Ub = inHand ? B : C, goneZ = inHand ? [] : [A.n], goneU = inHand ? [A.n] : B ? [A.n, B.n] : [A.n];
    // position on U from each spot (the balls before it gone)
    let cAt = () => 1, cDir = () => null;
    if (Ub) {
      const pC = pocketsFor(Ub, goneU), cv = new Float32Array(nx * ny), cu = new Array(nx * ny); let cBest = 1e-6;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const X = [cx(i), cy(j)]; if (!free(X[0], X[1])) continue; let b = 0, u = null;
        for (const o of pC) { const s = shot(X, Ub, o, goneU); if (s && !s.blk.length && s.cut <= 60 && s.ease > b) { b = s.ease; u = o.u; } }
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
    // ---- the stroke on A, in the physics simulation (V3.11) ----
    const MPH = [1.5, 2.5, 3.5, 4.5, 5.5, 7, 8.5, 10, 12, 15], TRY = [0, 1, 2, 3, 4, 5, 6, 8], TIPS = [-0.5, -0.35, -0.2, 0, 0.2, 0.35, 0.5];
    const init = () => [{ id: 0, x: cue.x, y: cue.y }].concat(objs.map(o => ({ id: o.n, x: o.x, y: o.y })));
    const run = (ang, v, a, b) => sim(init(), { angle: ang, speed: v, a, b }, P, { record: true, only: new Set([0]), maxT: 9 });
    const strokeOf = (p, a, b) => ({ tip: b, side: a, power: p + 1, mph: MPH[p], kind: b < -0.1 ? 'draw' : b > 0.1 ? 'follow' : 'center' });
    function after(r) { const ht = r.hitAt ? r.hitAt.t : 0, pts = (r.paths[0] || []).filter(q => q[0] >= ht).map(q => [q[1], q[2]]); return pts; }
    function searchA(out, zoneAt) {
      const cands = [];
      const val = (r, o) => {
        if (!r.pocketed.some(q => q.id === A.n) || r.pocketed.some(q => q.id === 0) || r.firstHit !== A.n) return -1;
        const c = r.final.find(q => q.id === 0); if (!c) return -1;
        if (zoneAt) { // green worth clearly more than yellow; more again rolling into the zone along its line (toward or away from the ball)
          const z = Math.pow(zoneAt([c.x, c.y]), 1.6), q = r.paths[0] || [], n = q.length; if (!z || n < 3) return z;
          const d = unit([q[n - 1][1] - q[n - 3][1], q[n - 1][2] - q[n - 3][2]]), rad = unit([c.x - Zb.x, c.y - Zb.y]); return z * (0.7 + 0.3 * Math.abs(dot(d, rad))); }
        const rd = Math.min(c.x, L - c.x, c.y, W - c.y); return rd < 3 ? 0.5 : 0.8; // the last ball: just stay off the cushion
      };
      // simple strokes first: soft to medium (power 5 or less), the tip near the middle, no side unless it pays (owner, Nov 9)
      const simple = (p, a, b) => (p <= 4 ? 1 : Math.pow(0.78, p - 4)) * (1 - 0.6 * Math.max(0, Math.abs(b) - 0.2)) * (a ? 0.85 : 1);
      for (const o of pA) {
        const s = shot(pt(cue), A, o, []); if (!s || s.blk.length || s.cut > 70) continue;
        const ang0 = Math.atan2(s.G[1] - cue.y, s.G[0] - cue.x);
        // a ball just behind the cue ball (owner, Nov 9: the 7 behind on a straight-in 4): the cue has to be raised, so no
        // real draw and no hard hit
        const back = [-Math.cos(ang0), -Math.sin(ang0)], jack = objs.some(q => { const d = [q.x - cue.x, q.y - cue.y], t = dot(d, back); return t > 0 && t < 9 && Math.abs(d[0] * back[1] - d[1] * back[0]) < 1.9; });
        if (jack) out.jacked = true;
        for (const p of TRY) for (const b of TIPS) {
          if (jack && (b < -0.2 || p > 5)) continue;
          let best = null;
          for (const da of [0, 0.5, -0.5, 1, -1]) { // the aim corrected a little where throw would miss it
            const r = run(ang0 + da * D2R, MPH[p] * 17.6, 0, b), v = val(r, o); if (v >= 0) { best = { r, v, da }; break; }
          }
          if (best) cands.push({ o, s, ang: ang0 + best.da * D2R, p, a: 0, b, v: best.v, r: best.r });
        }
      }
      if (!cands.length) return null;
      // the best few, again with small mistakes: aim 0.35 degrees either way, speed 12% either way, tip 0.1 either way
      const robust = c => { let t = 0, n = 0; for (const [da, dv, db] of [[0.35, 1, 0], [-0.35, 1, 0], [0, 1.12, 0], [0, 0.88, 0], [0, 1, 0.1], [0, 1, -0.1]]) {
        const r = run(c.ang + da * D2R, MPH[c.p] * 17.6 * dv, c.a, Math.max(-0.55, Math.min(0.55, c.b + db))), v = val(r, c.o); t += Math.max(0, v); n++; } return t / n; };
      // what it is worth: mostly how well it holds up to small mistakes, a stroke that only works when perfect is nearly worthless
      const score = c => (0.25 * c.v + 0.75 * c.rob) * (c.rob < 0.1 ? 0.3 : 1) * simple(c.p, c.a, c.b);
      cands.sort((x, y) => y.v * simple(y.p, y.a, y.b) - x.v * simple(x.p, x.a, x.b));
      const top = cands.slice(0, 12); for (const c of top) c.rob = robust(c);
      top.sort((x, y) => score(y) - score(x));
      // side spin on the three best (the cue ball off the cushions, and the angle off the object ball)
      for (const c of top.slice(0, 3)) for (const a of [-0.3, 0.3]) {
        let best = null; for (const da of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) { const r = run(c.ang + da * D2R, MPH[c.p] * 17.6, a, c.b), v = val(r, c.o); if (v >= 0) { best = { r, v, da }; break; } }
        if (best) { const n2 = { o: c.o, s: c.s, ang: c.ang + best.da * D2R, p: c.p, a, b: c.b, v: best.v, r: best.r }; n2.rob = robust(n2); top.push(n2); }
      }
      top.sort((x, y) => score(y) - score(x)); const w = top[0];
      const alts = top.slice(0, 4).map(c => ({ pocket: c.o.pi, tip: c.b, side: c.a, power: c.p + 1, zone: +c.v.toFixed(2), robust: +c.rob.toFixed(2), score: +score(c).toFixed(3) }));
      // the band of the cue ball's path: the stroke aimed to the inside and to the outside of the pocket (the ball still in)
      let lo = null, hi = null;
      for (let d = -2; d <= 2.001; d += 0.25) { const r = run(w.ang + d * D2R, MPH[w.p] * 17.6, w.a, w.b); if (val(r, w.o) < 0) continue; if (!lo) lo = r; hi = r; }
      const c0 = w.r.final.find(q => q.id === 0);
      return { val: score(w), pocket: w.o.pi, cut: Math.round(w.s.cut), ghost: w.s.G, pts: after(w.r), stroke: Object.assign(strokeOf(w.p, w.a, w.b), { hard: w.rob < 0.3, jacked: !!out.jacked }), fan: lo && hi && lo !== hi ? [after(lo), after(hi)] : null, p: [c0.x, c0.y], zone: +w.v.toFixed(2), robust: +w.rob.toFixed(2), alts };
    }
    // no shape to play for (the last ball, or no zone): still the shot line and a stroke that makes it
    function finishA(out) {
      const o = pA.find(q => q.pi === out.A.pocket); if (!o) return; const s = shot(pt(cue), A, o, []); if (!s) return;
      const pl = sim && !inHand ? searchA(out, null) : null;
      out.path = pl ? { ghost: pl.ghost, pts: pl.pts, kind: pl.stroke.kind, s: pl.stroke.tip, cut: pl.cut, stroke: pl.stroke, fan: pl.fan, p: pl.p, noShape: true } : { ghost: s.G, pts: [], cut: Math.round(s.cut), noShape: true };
      if (pl) out.A.pocket = pl.pocket;
    }
    const out = { L, W, R, order: ord.map(o => o.n), A: { n: A.n, pocket: null }, B: B ? { n: B.n, pocket: null } : null, C: C ? { n: C.n, pocket: null } : null, step: STEP, nx, ny, origin: [R, R], cells: null, path: null, spot: null, route: null };
    const pA = pocketsFor(A, []);
    const easiestA = () => { let best = null; for (const o of pA) { const s = shot(pt(cue), A, o, []); if (s && !s.blk.length && s.cut <= 70 && (!best || s.ease > best.e)) best = { e: s.ease, pi: o.pi }; } return best ? best.pi : pA.length ? pA[0].pi : null; };
    out.inHand = inHand;
    if (!B && !inHand) { out.A.pocket = easiestA(); finishA(out); out.ms = Date.now() - t0; return out; }
    // the zone, for each of the ball's pockets; keep the pocket with the biggest, best zone
    const pB = pocketsFor(Zb, goneZ); let bestZ = null; const zones = [];
    for (const o of pB) {
      const g = new Int8Array(nx * ny), sc = new Float32Array(nx * ny); let n = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const X = [cx(i), cy(j)]; if (!free(X[0], X[1])) continue;
        const s = shot(X, Zb, o, goneZ); if (!s) continue;
        if (s.blk.length) { g[j * nx + i] = 4; continue; } // grey: in the way
        if (s.cut > 60) continue;
        let posC = 1; if (Ub) { posC = 0; for (const r of exits(s, o, goneU)) { if (r.pts.scratch) continue; const v = pathValue(r); if (v > posC) posC = v; } }
        const angle = s.cut < 6 ? 0.55 : s.cut < 12 ? 0.8 : s.cut <= 40 ? 1 : 0.75;
        const rd = Math.min(X[0], L - X[0], X[1], W - X[1]), rail = rd < 2.5 ? 0.55 : rd < 4.5 ? 0.85 : 1;
        const v = Math.min(1, s.ease / 0.6) * angle * rail * (0.25 + 0.75 * posC);
        sc[j * nx + i] = v; g[j * nx + i] = Ub && posC < 0.12 ? 3 : 9; n++; // 3 red; 9 graded below
      }
      const worth = Array.from(sc).sort((a, b) => b - a).slice(0, Math.round(150 / (STEP * STEP))).reduce((a, b) => a + b, 0);
      const z = { o, g, sc, worth }; zones.push(z); if (!bestZ || worth > bestZ.worth) bestZ = z;
    }
    if (!bestZ) { if (!inHand) { out.A.pocket = easiestA(); finishA(out); } out.ms = Date.now() - t0; return out; }
    // every pocket's zone graded against the best spot of all (V3.11: position counts for whichever pocket the ball is then
    // played in; the plan's pocket for it is the one the planned stroke leaves it best for)
    const top = Math.max(...zones.map(z => Math.max(...z.sc))) || 1;
    for (const z of zones) {
      for (let k = 0; k < nx * ny; k++) if (z.g[k] === 9) { const r = z.sc[k] / top; z.g[k] = r >= 0.62 ? 1 : r >= 0.38 ? 2 : 0; } // 1 green, 2 amber
      // one smoothing pass (the grid samples the zone's edges unevenly): a yellow spot ringed by green is green, a lone green spot yellow
      const g0 = z.g.slice(), at = (i, j) => i < 0 || j < 0 || i >= nx || j >= ny ? 0 : g0[j * nx + i];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (g0[k] !== 1 && g0[k] !== 2) continue; let n1 = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && at(i + di, j + dj) === 1) n1++;
        if (g0[k] === 2 && n1 >= 5) z.g[k] = 1; else if (g0[k] === 1 && n1 <= 1) z.g[k] = 2; }
    }
    const zv = (z, p) => { const k = idx(p); if (k < 0) return 0; const g = z.g[k]; return g === 1 || g === 2 ? z.sc[k] / top : 0; };
    const zoneAt = p => Math.max(0, ...zones.map(z => zv(z, p)));
    // A, the ball being shot (V3.11, owner Nov 9: the plans asked for strokes that could not be played): real strokes tried
    // in the physics simulation (core.js simulate: tip height, side spin, speed, throw, cushions), each pocket the ball can
    // go in, power 1-10; kept only when the ball goes in and the cue ball stays up; scored on where the cue ball stops in the
    // zone, the same stroke with small mistakes (aim, speed, tip), and how simple it is (soft to medium, near the middle)
    let pl = null;
    if (!inHand && sim) pl = searchA(out, zoneAt);
    else if (!inHand) { // (no simulation given: the old ray model)
      for (const o of pA) {
        const s = shot(pt(cue), A, o, []); if (!s || s.blk.length || s.cut > 60) continue;
        for (const r of exits(s, o, [A.n])) {
          if (r.pts.scratch) continue; let inG = 0, first = -1, last = -1, along = 0;
          r.pts.forEach((q, i) => { const k = idx(q); if (k >= 0 && bestZ.g[k] === 1) { if (first < 0) first = i; inG++; last = i;
            if (i) { const d = unit(sub(q, r.pts[i - 1])), rad = unit(sub(q, pt(B))); along += 0.35 + 0.65 * Math.abs(dot(d, rad)); } } });
          if (!inG) continue;
          const val = Math.min(along, 16) * (s.ease / 0.6) * spinF(r) * Math.exp(-first / 40) * speedF(r, (first + last) / 2);
          if (!pl || val > pl.val) pl = { val, pocket: o.pi, cut: Math.round(s.cut), kind: r.kind, s: r.s, vf: r.vf, ghost: s.G, pts: r.pts.slice(0, Math.round((first + last) / 2) + 1), stroke: stroke(r.s, r.vf, Math.round((first + last) / 2)) };
        }
      }
    }
    if (!inHand && pl && pl.p) { let bz = bestZ, bv = zv(bestZ, pl.p); for (const z of zones) { const v = zv(z, pl.p); if (v > bv + 1e-6) { bv = v; bz = z; } } bestZ = bz; }
    out.cells = bestZ.g; if (inHand) out.A.pocket = bestZ.o.pi; else out.B.pocket = bestZ.o.pi;
    if (!inHand) {
      out.A.pocket = pl ? pl.pocket : easiestA();
      if (pl) out.path = { ghost: pl.ghost, pts: pl.pts, kind: pl.stroke.kind, s: pl.stroke.tip, cut: pl.cut, stroke: pl.stroke, fan: pl.fan || null, p: pl.p, zone: pl.zone, robust: pl.robust, alts: pl.alts };
      else finishA(out);
    }
    // the zone's spot the plan aims for, the shot on B from there and where the cue ball goes on to for C
    const greens = []; for (let k = 0; k < nx * ny; k++) if (bestZ.g[k] === 1) greens.push([cx(k % nx), cy(Math.floor(k / nx)), bestZ.sc[k]]);
    let sp = null;
    if (!inHand && pl && pl.p) sp = [pl.p[0], pl.p[1], 1]; // the perfect spot: where the planned stroke stops
    else if (inHand) { const d = q => Math.hypot(q[0] - A.x, q[1] - A.y); sp = greens.sort((a, b) => b[2] * Math.exp(-d(b) / 40) - a[2] * Math.exp(-d(a) / 40))[0]; }
    else if (pl) { // the best-graded spot within 6 in of where the planned path stops, inside the green
      const m = pl.pts[pl.pts.length - 1], d = q => Math.hypot(q[0] - m[0], q[1] - m[1]), inner = q => { const i = Math.floor((q[0] - R) / STEP), j = Math.floor((q[1] - R) / STEP); return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const ii = i + a, jj = j + b; return ii >= 0 && jj >= 0 && ii < nx && jj < ny && bestZ.g[jj * nx + ii] === 1; }); };
      const close = greens.filter(q => d(q) <= 6 && inner(q)); sp = close.length ? close.sort((a, b) => b[2] - a[2])[0] : greens.sort((a, b) => d(a) - d(b))[0]; }
    else sp = greens.sort((a, b) => b[2] - a[2])[0];
    if (sp) {
      const X = [sp[0], sp[1]], s2 = shot(X, Zb, bestZ.o, goneZ); out.spot = X; if (s2) (inHand ? out.A : out.B).cut = Math.round(s2.cut);
      if (inHand && s2) out.path = { ghost: s2.G, pts: [], inHand: true };
      if (Ub && s2) {
        let br = null, bv = -1; for (const r of exits(s2, bestZ.o, goneU)) { if (r.pts.scratch) continue; const v = pathValue(r); if (v > bv) { bv = v; br = r; } }
        if (br) {
          let stop = 3, sv = -1; br.pts.forEach((q, i) => { if (i < 3) return; const v = cAt(q) * Math.exp(-i / 70) * speedF(br, i); if (v > sv) { sv = v; stop = i; } });
          out.route = { ghost: s2.G, pts: br.pts.slice(0, stop + 1), kind: br.kind, s: br.s };
          const end = br.pts[stop]; let cl = null;
          for (const o of pocketsFor(Ub, goneU)) { const s3 = shot(end, Ub, o, goneU); if (s3 && !s3.blk.length && (!cl || s3.ease > cl.e)) cl = { e: s3.ease, pi: o.pi, cut: Math.round(s3.cut) }; }
          if (cl) { const tgt = inHand ? out.B : out.C; tgt.pocket = cl.pi; tgt.cut = cl.cut; }
        }
      }
    }
    if (C && out.C.pocket == null) { const pC = pocketsFor(C, [A.n, B.n]); if (pC.length) out.C.pocket = pC.sort((a, b) => a.dist - b.dist)[0].pi; }
    if (inHand && B && out.B.pocket == null) { const pq = pocketsFor(B, [A.n]); if (pq.length) out.B.pocket = pq.sort((a, b) => a.dist - b.dist)[0].pi; }
    out.shapes = shapes(out, Zb);
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
  // the stroke for a planned cue-ball path: where the tip meets the cue ball (up for follow, down for draw: a natural roll is
  // about 2/5 of the radius above the middle) and the power, 1-10 (4: a medium stroke, about 40 in of travel leaving at half
  // the hit's speed); from the spin s, the speed the cue ball leaves at (vf, of the hit's) and how far it travels (d, in)
  function stroke(sp, vf, d) {
    const tip = Math.max(-0.6, Math.min(0.6, sp * 0.4)), q = Math.sqrt(Math.max(4, d) / 40) / (Math.max(0.05, vf) / 0.5);
    return { tip: +tip.toFixed(2), side: 0, power: Math.max(1, Math.min(10, Math.round(q * 4))), kind: sp < -0.1 ? 'draw' : sp > 0.1 ? 'follow' : 'stun' };
  }
  // the zone as a cone fanning out from the next ball (owner, Nov 9): as wide as the green seen from that ball, from its
  // nearest to its far reach; the outer tenth on each side yellow (still good, but harder to make and to get on from), and
  // the ideal line down the middle through the spot. Clipped to the table.
  function clip(poly, x0, y0, x1, y1) {
    const edges = [[p => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [p => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
      [p => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]], [p => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
    for (const [inside, cut] of edges) { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b); if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)); } poly = out; if (!poly.length) break; }
    return poly;
  }
  function sector(c, r0, r1, a0, a1, Lt, Wt, R) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (4 * D2R))), pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([c[0] + r1 * Math.cos(a), c[1] + r1 * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; pts.push([c[0] + r0 * Math.cos(a), c[1] + r0 * Math.sin(a)]); }
    return clip(pts, R, R, Lt - R, Wt - R);
  }
  function cone(pl, gp, B, Lt, Wt, R) {
    const c = [B.x, B.y], cells = [].concat(...gp.map(q => q.ks)).map(k => [pl.origin[0] + (k % pl.nx + 0.5) * pl.step, pl.origin[1] + (Math.floor(k / pl.nx) + 0.5) * pl.step]);
    if (cells.length < 3) return null;
    const ang = p => Math.atan2(p[1] - c[1], p[0] - c[0]), ref = pl.spot ? ang(pl.spot) : ang(cells[Math.floor(cells.length / 2)]);
    const rel = p => { let a = ang(p) - ref; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const BIN = 2 * D2R, NB = 90, cnt = new Array(2 * NB + 1).fill(0), bin = a => Math.round(a / BIN) + NB;
    const ar = cells.map(p => ({ a: rel(p), r: Math.hypot(p[0] - c[0], p[1] - c[1]) }));
    for (const q of ar) { const b = bin(q.a); if (b >= 0 && b < cnt.length) cnt[b]++; }
    let lo = NB, hi = NB; const has = b => b >= 0 && b < cnt.length && cnt[b] > 0;
    while (has(lo - 1) || has(lo - 2)) lo--; while (has(hi + 1) || has(hi + 2)) hi++;
    const a0 = (lo - NB - 0.5) * BIN, a1 = (hi - NB + 0.5) * BIN, rs = ar.filter(q => q.a >= a0 && q.a <= a1).map(q => q.r).sort((x, y) => x - y);
    const r0 = 2 * R + 0.5, r1 = Math.max(r0 + 2, rs[Math.min(rs.length - 1, Math.floor(rs.length * 0.95))]);
    const w = a1 - a0, e = Math.max(w * 0.1, 1.5 * D2R), A0 = ref + a0, A1 = ref + a1;
    const core = sector(c, r0, r1, A0 + e, A1 - e, Lt, Wt, R), sides = [sector(c, r0, r1, A0, A0 + e, Lt, Wt, R), sector(c, r0, r1, A1 - e, A1, Lt, Wt, R)];
    const line = [[c[0] + r0 * Math.cos(ref), c[1] + r0 * Math.sin(ref)], [c[0] + r1 * Math.cos(ref), c[1] + r1 * Math.sin(ref)]];
    return { core, sides, line, from: c, r0: +r0.toFixed(1), r1: +r1.toFixed(1), width: Math.round(w / D2R) };
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
    return { green, red, blocked, from: [B.x, B.y], far, cone: gp.length ? cone(pl, gp, B, pl.L, pl.W, pl.R) : null };
  }
  // the grade of a cue-ball spot in a plan's zone: 'green' | 'amber' | 'red' | 'blocked' | null
  function gradeAt(pl, x, y) {
    if (!pl || !pl.cells) return null; const i = Math.floor((x - pl.origin[0]) / pl.step), j = Math.floor((y - pl.origin[1]) / pl.step);
    if (i < 0 || j < 0 || i >= pl.nx || j >= pl.ny) return null; return ({ 1: 'green', 2: 'amber', 3: 'red', 4: 'blocked' })[pl.cells[j * pl.nx + i]] || null;
  }
  // the power scale (V3.11): power 1-10 as cue-ball speeds, mph
  const POWER_MPH = [1.5, 2.5, 3.5, 4.5, 5.5, 7, 8.5, 10, 12, 15];
  const powerOf = mph => { const m = POWER_MPH; if (mph <= m[0]) return mph / m[0]; for (let i = 1; i < m.length; i++) if (mph <= m[i]) return i + (mph - m[i - 1]) / (m[i] - m[i - 1]); return 10 + (mph - m[9]) / 3; };
  // the speed a lone cue ball was struck at, from where it started, its first direction and how far it went (in), in the
  // simulation (cushions included); for the power test
  function speedFor(start, dir, dist, P, b) {
    if (!sim) return null; let lo = 3, hi = 600; P = Object.assign({}, P, { pockets: [] }); // (a roll into a pocket does not count)
    const len = v => { const r = sim([{ id: 0, x: start[0], y: start[1] }], { angle: Math.atan2(dir[1], dir[0]), speed: v, a: 0, b: b || 0 }, P, { record: true, maxT: 40 }), q = r.paths[0] || []; let s0 = 0; for (let i = 1; i < q.length; i++) s0 += Math.hypot(q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]); return s0; };
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (len(m) < dist) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  return { plan, gradeAt, POWER_MPH, powerOf, speedFor };
}
const COACH = coachFactory(typeof simulate !== 'undefined' ? simulate : typeof module !== 'undefined' ? require('../core.js').simulate : null);
if (typeof module !== 'undefined') module.exports = COACH;
