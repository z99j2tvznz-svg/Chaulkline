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
    P = Object.assign({}, P, { cushionRoll: P.cushionRoll == null ? 0.6 : P.cushionRoll }); // livelier cushions (see core.js cushion)
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
        out.push({ pi, pk, u: unit(v), dist: vl, entry });
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
    // the chance of making a shot (V3.12, owner Nov 9: percentages, not scores): the cue ball's line off by a good amateur's
    // aim error (about 0.2 degrees, plus 0.6 degrees on the object ball for stroke and throw), turned into the object ball's
    // error through the cut (a thinner cut magnifies it) and set against the pocket's width seen from the ball (corner about
    // 2.8 in wide, side 2 in, narrower from a steep entry). To be tuned from the owner's sessions.
    const AIM_SD = 0.2 * D2R, OB_SD = 0.6 * D2R;
    function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
    function pMake(s, o) {
      const tol = (o.pk.corner ? 1.4 : 1.0) * Math.max(0.35, Math.cos((o.entry || 0) * D2R)), tolA = Math.atan(tol / Math.max(1, o.dist));
      const sd = Math.hypot(s.dl * AIM_SD / (2 * R * Math.max(0.25, Math.cos(s.cut * D2R))), OB_SD);
      return erf(tolA / (sd * Math.SQRT2));
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
    // power 1-10 on Dr. Dave's speed scale (V3.11.1): 1-2 slow (1-2 mph), 3-5 medium (2-4), 6-8 fast (4-7), 9-10 a power shot (7-10)
    const MPH = [0.9, 1.5, 2.1, 2.8, 3.5, 4.3, 5.3, 6.4, 7.8, 9.5], TRY = [0, 1, 2, 3, 4, 5, 6, 7, 8], TIPS = [-0.5, -0.35, -0.2, 0, 0.2, 0.35, 0.5];
    const init = () => [{ id: 0, x: cue.x, y: cue.y }].concat(objs.map(o => ({ id: o.n, x: o.x, y: o.y })));
    const run = (ang, v, a, b) => sim(init(), { angle: ang, speed: v, a, b }, P, { record: true, only: new Set([0]), maxT: 9 });
    const strokeOf = (p, a, b) => ({ tip: b, side: a, power: p + 1, mph: MPH[p], kind: b < -0.1 ? 'draw' : b > 0.1 ? 'follow' : 'center' });
    function after(r) { const ht = r.hitAt ? r.hitAt.t : 0, pts = (r.paths[0] || []).filter(q => q[0] >= ht).map(q => [q[1], q[2]]); return pts; }
    // ---- the plan for A (V3.12): every kind of shot, with real percentages ----
    // Strokes run in the simulation; each candidate run again with a good amateur's errors (aim 0.2 degrees, speed 8%, tip
    // and side 0.05 of the radius) to count how often A goes in and where the cue ball ends: its percentage to make, and the
    // chance of the next shot from where it stops (the zone's percentages). Kinds: pot (straight at A), bank (A off one
    // cushion), kick (the cue ball off one or two cushions first) and safety (A hit, the cue ball and A left so the other
    // player has little). The best is shown first whatever its percentage (owner, Nov 9: there is always a shot); the best of
    // another kind is kept as the alternative. Jump shots are not planned.
    function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const gauss = r => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
    const runAll = (ang, v, a, b, balls) => sim(balls || init(), { angle: ang, speed: v, a, b }, P, { record: true, only: new Set([0, A.n]), maxT: 9 });
    // where the balls really are is known to about 0.3 in (V3.13, owner Nov 9: near straight in, a cut read left may be a cut
    // right, and follow then scratches). The player aims at the real balls, so in each repeated run of a pot or a bank the
    // balls are moved by that much and the aim taken to the moved ghost ball: the make hardly changes, the cut and so the cue
    // ball's way do, and a plan that only works with the positions exact loses its percentage
    const POS_SD = 0.3;
    const pathOf = (r, id, fromHit) => { const ht = fromHit && r.hitAt ? r.hitAt.t : -1, q = r.paths[id] || []; return q.filter(z => fromHit === false ? (!r.hitAt || z[0] <= r.hitAt.t) : z[0] >= ht).map(z => [z[1], z[2]]); };
    const mirror = (p, c) => c === 0 ? [2 * R - p[0], p[1]] : c === 1 ? [2 * (L - R) - p[0], p[1]] : c === 2 ? [p[0], 2 * R - p[1]] : [p[0], 2 * (W - R) - p[1]];
    // the other player's best chance after a safety: from where the cue ball stopped, on the lowest ball left, straight in
    function oppBest(r) {
      const fin = r.final, cb = fin.find(q => q.id === 0); if (!cb) return 1;
      const left = fin.filter(q => q.id !== 0 && ord.some(o => o.n === q.id)).sort((x, y) => x.id - y.id), T = left[0]; if (!T) return 0;
      const blk = (a, b, skip) => fin.some(q => !skip.includes(q.id) && segDist([q.x, q.y], a, b) < 2 * R - 0.05);
      let best = 0;
      P.pockets.forEach(pk => {
        const v = sub([pk.x, pk.y], [T.x, T.y]), vl = len(v); if (vl < 0.5 || blk([T.x, T.y], [pk.x, pk.y], [T.id])) return;
        const u = unit(v), G = [T.x - 2 * R * u[0], T.y - 2 * R * u[1]], aim = sub(G, [cb.x, cb.y]), dl = len(aim); if (dl < 2.2 * R || blk([cb.x, cb.y], G, [0, T.id])) return;
        const cut = Math.acos(Math.max(-1, Math.min(1, dot(unit(aim), u)))) / D2R; if (cut > 70) return;
        const nx = pk.corner ? (pk.x < L / 2 ? -1 : 1) / Math.SQRT2 : 0, ny = pk.corner ? (pk.y < W / 2 ? -1 : 1) / Math.SQRT2 : (pk.y < W / 2 ? -1 : 1), entry = Math.acos(Math.max(-1, Math.min(1, (v[0] * nx + v[1] * ny) / vl))) / D2R;
        if (entry > (pk.corner ? 55 : 45)) return;
        best = Math.max(best, pMake({ dl, cut }, { pk, dist: vl, entry }));
      });
      return best;
    }
    function searchA(out, zoneAt) {
      const R0 = rng(1234 + Math.round(cue.x * 7 + cue.y * 13));
      const potted = r => r.pocketed.some(q => q.id === A.n) && !r.pocketed.some(q => q.id === 0) && r.firstHit === A.n;
      // the next shot's chance from where the cue ball stopped (the zone), a little more coming in along the zone's line
      const nextQ = r => {
        const c = r.final.find(q => q.id === 0); if (!c) return 0;
        if (!zoneAt) { const rd = Math.min(c.x, L - c.x, c.y, W - c.y); return rd < 3 ? 0.9 : 1; }
        const z = zoneAt([c.x, c.y]), q = r.paths[0] || [], n = q.length; if (!z || n < 3) return z;
        const d = unit([q[n - 1][1] - q[n - 3][1], q[n - 1][2] - q[n - 3][2]]), rad = unit([c.x - Zb.x, c.y - Zb.y]); return Math.min(1, z * (0.75 + 0.25 * Math.abs(dot(d, rad)))); // into the line (owner, Nov 9)
      };
      // simple strokes first: soft to medium, the tip near the middle, no side unless it pays; few cushions (Dr. Dave)
      const simple = c => (c.p <= 5 ? 1 : Math.pow(0.85, c.p - 5)) * (1 - 0.5 * Math.max(0, Math.abs(c.b) - 0.2)) * (c.a ? 0.9 : 1);
      const rails = pts => { let n = 0, on = false; for (const p of pts) { const at = p[0] < R + 0.25 || p[0] > L - R - 0.25 || p[1] < R + 0.25 || p[1] > W - R - 0.25; if (at && !on) n++; on = at; } return n; };
      const railF = r => { const n = rails(after(r)); return n <= 1 ? 1 : Math.pow(0.85, n - 1); };
      // a candidate's percentages: N runs with the player's errors
      const mc = (c, N) => {
        let made = 0, q = 0, legal = 0, opp = 0;
        for (let i = 0; i < N; i++) {
          const ea = gauss(R0) * AIM_SD, ev = 1 + gauss(R0) * 0.08, es = gauss(R0) * 0.05, et = gauss(R0) * 0.05;
          const r = runAll(c.ang + ea, MPH[c.p] * 17.6 * ev, c.a + es, Math.max(-0.55, Math.min(0.55, c.b + et)));
          if (c.kind === 'safety') { const ok = r.firstHit === A.n && !r.pocketed.some(z => z.id === 0) && (r.railAfter || r.pocketed.length); if (ok) { legal++; opp += oppBest(r); } continue; }
          if (!potted(r)) continue; made++;
          // the leave with the balls where they may really be (the make is the player's, who sees the real balls; the cut and
          // so the cue ball's way are what the app may have wrong): the same stroke on the moved balls, aimed at the moved ghost
          let rq = r;
          if ((c.kind === 'pot' || c.kind === 'bank') && c.o && c.o.pk) {
            const balls = init().map(q => ({ id: q.id, x: q.x + gauss(R0) * POS_SD, y: q.y + gauss(R0) * POS_SD })), a1 = balls.find(q => q.id === A.n), c1 = balls[0];
            const tgt = c.kind === 'bank' ? mirror([c.o.pk.x, c.o.pk.y], c.cu) : [c.o.pk.x, c.o.pk.y], u = unit(sub(tgt, [a1.x, a1.y])), G = [a1.x - 2 * R * u[0], a1.y - 2 * R * u[1]];
            const r2 = runAll(Math.atan2(G[1] - c1.y, G[0] - c1.x) + (c.da || 0) + ea, MPH[c.p] * 17.6 * ev, c.a + es, Math.max(-0.55, Math.min(0.55, c.b + et)), balls);
            rq = r2.pocketed.some(z => z.id === 0) ? null : r2; // a scratch there: no leave
          }
          q += rq ? nextQ(rq) : 0;
        }
        if (c.kind === 'safety') { c.legal = legal / N; c.opp = legal ? opp / legal : 1; c.value = 0.35 * c.legal * (1 - c.opp) * simple(c); c.pMake = 0; c.pNext = 0; return c; }
        // offence first: a sure pot with a poor leave (0.6) still beats the best safety (0.5); a 50/50 pot does not
        // (V3.13, Nov 8 20:50: plans made the ball and left the cue ball out of the zone): the leave counts more
        c.pMake = made / N; c.pNext = made ? q / made : 0; c.value = c.pMake * (0.4 + 0.6 * c.pNext) * simple(c) * (c.rf || 1); return c;
      };
      const all = [];
      // 1. straight at A: every pocket, tip, speed (the nominal stroke first; the aim nudged up to a degree for throw)
      const direct = [];
      for (const o of pA) {
        const s = shot(pt(cue), A, o, []); if (!s || s.blk.length || s.cut > 75) continue;
        const ang0 = Math.atan2(s.G[1] - cue.y, s.G[0] - cue.x);
        const back = [-Math.cos(ang0), -Math.sin(ang0)], jack = objs.some(q => { const d = [q.x - cue.x, q.y - cue.y], t = dot(d, back); return t > 0 && t < 9 && Math.abs(d[0] * back[1] - d[1] * back[0]) < 1.9; });
        if (jack) out.jacked = true;
        for (const p of TRY) for (const b of TIPS) {
          if (jack && (b < -0.2 || p > 5)) continue;
          for (const da of [0, 0.5, -0.5, 1, -1]) { const r = runAll(ang0 + da * D2R, MPH[p] * 17.6, 0, b); if (potted(r)) { direct.push({ kind: 'pot', o, s, ang: ang0 + da * D2R, da: da * D2R, p, a: 0, b, r, v0: nextQ(r) * railF(r), rf: railF(r) }); break; } }
        }
      }
      const pre = c => c.v0 * simple(c) * (c.p >= 1 && c.p <= 4 ? 1 : 0.9) * (Math.abs(c.b) <= 0.2 ? 1 : 0.95);
      direct.sort((x, y) => pre(y) - pre(x));
      const top = direct.slice(0, 14).map(c => mc(c, 10)); top.sort((x, y) => y.value - x.value);
      for (const c of top.slice(0, 3)) for (const a of [-0.3, 0.3]) { // side spin on the best three
        for (const da of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) { const r = runAll(c.ang + da * D2R, MPH[c.p] * 17.6, a, c.b); if (potted(r)) { top.push(mc({ kind: 'pot', o: c.o, s: c.s, ang: c.ang + da * D2R, da: (c.da || 0) + da * D2R, p: c.p, a, b: c.b, r, rf: railF(r) }, 12)); break; } }
      }
      all.push(...top);
      const bestPot = () => Math.max(0, ...all.filter(c => c.kind !== 'safety').map(c => c.value));
      // 2. banks: A off one cushion (the pocket mirrored in the cushion), the cue ball straight at its ghost
      if (bestPot() < 0.55) {
        const banks = [];
        P.pockets.forEach((pk, pi) => { for (let cu = 0; cu < 4; cu++) {
          if ((cu === 0 && pk.x < 1) || (cu === 1 && pk.x > L - 1) || (cu === 2 && pk.y < 1) || (cu === 3 && pk.y > W - 1)) continue;
          const m = mirror([pk.x, pk.y], cu), u = unit(sub(m, pt(A))), G = [A.x - 2 * R * u[0], A.y - 2 * R * u[1]];
          const tt = cu < 2 ? ((cu === 0 ? R : L - R) - A.x) / (m[0] - A.x) : ((cu === 2 ? R : W - R) - A.y) / (m[1] - A.y); if (!(tt > 0 && tt < 1)) continue;
          const hit = [A.x + (m[0] - A.x) * tt, A.y + (m[1] - A.y) * tt]; if (P.pockets.some(q => Math.hypot(q.x - hit[0], q.y - hit[1]) < 5)) continue;
          const aim = sub(G, pt(cue)); if (len(aim) < 2.5 * R || blockers(pt(cue), G, [A.n]).length) continue;
          if (Math.acos(Math.max(-1, Math.min(1, dot(unit(aim), u)))) / D2R > 60) continue;
          const ang0 = Math.atan2(aim[1], aim[0]);
          for (const p of [3, 5, 7]) for (const da of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1]) { const r = runAll(ang0 + da * D2R, MPH[p] * 17.6, 0, 0); if (potted(r)) { banks.push({ kind: 'bank', o: { pi, pk }, cu, s: { G, cut: 0 }, ang: ang0 + da * D2R, da: da * D2R, p, a: 0, b: 0, r, rf: railF(r) }); break; } }
        } });
        all.push(...banks.map(c => mc(c, 10)));
      }
      // 3. kicks: the cue ball off one or two cushions to A's ghost (to pot it), or to A itself (to hit it)
      if (bestPot() < 0.4) {
        const targets = pA.map(o => ({ o, G: [A.x - 2 * R * o.u[0], A.y - 2 * R * o.u[1]] }));
        const kicks = [], tryKick = (Gm, o, k, rails2) => {
          const aim = sub(Gm, pt(cue)), ang0 = Math.atan2(aim[1], aim[0]);
          for (const p of [3, 5, 7]) for (const da of [0, 0.6, -0.6, 1.2, -1.2]) {
            const r = runAll(ang0 + da * D2R, MPH[p] * 17.6, 0, 0);
            if (potted(r)) { kicks.push({ kind: rails2 ? 'kick2' : 'kick', o, s: { G: Gm, cut: 0 }, ang: ang0 + da * D2R, p, a: 0, b: 0, r, rf: 1 }); return true; }
          }
          return false;
        };
        for (const t of targets) for (let cu = 0; cu < 4; cu++) tryKick(mirror(t.G, cu), t.o, cu, false);
        if (!kicks.length) for (const t of targets) for (const [c1, c2] of [[0, 2], [0, 3], [1, 2], [1, 3], [2, 0], [3, 0], [2, 1], [3, 1]]) tryKick(mirror(mirror(t.G, c1), c2), t.o, c1, true);
        all.push(...kicks.map(c => mc(c, 10)));
      }
      // 4. safety: A hit softly, full or thin either side, straight or off a cushion when A cannot be seen
      if (bestPot() < 0.5) {
        const safe = [], see = !blockers(pt(cue), pt(A), [A.n]).length;
        const aims = see ? [0, 1, -1].map(k => { const d = unit(sub(pt(A), pt(cue))), n = [-d[1], d[0]]; return [A.x + n[0] * k * 1.8, A.y + n[1] * k * 1.8]; }) : [0, 1, 2, 3].map(cu => mirror(pt(A), cu));
        for (const T of aims) { const aim = sub(T, pt(cue)), ang0 = Math.atan2(aim[1], aim[0]);
          for (const p of [0, 1, 2, 3]) for (const b of [-0.2, 0, 0.2]) { const r = runAll(ang0, MPH[p] * 17.6, 0, b); if (r.firstHit === A.n && !r.pocketed.some(z => z.id === 0) && (r.railAfter || r.pocketed.length)) safe.push({ kind: 'safety', o: null, s: { G: T, cut: 0 }, ang: ang0, p, a: 0, b, r, v0: 1 - oppBest(r) }); } }
        safe.sort((x, y) => y.v0 - x.v0); all.push(...safe.slice(0, 4).map(c => mc(c, 8)));
      }
      if (!all.length) return null;
      all.sort((x, y) => y.value - x.value);
      // the best three again with more runs before one is picked (a small sample flatters the lucky one)
      const fin = all.slice(0, 3).map(c => mc(Object.assign({}, c), 24)); fin.sort((x, y) => y.value - x.value);
      const w = fin[0], alt = fin.concat(all).find(c => c.kind !== w.kind);
      // the band of the cue ball's path: the same stroke aimed to the inside and to the outside of the pocket (A still in)
      let lo = null, hi = null;
      if (w.kind !== 'safety') for (let d = -2; d <= 2.001; d += 0.25) { const r = runAll(w.ang + d * D2R, MPH[w.p] * 17.6, w.a, w.b); if (!potted(r)) continue; if (!lo) lo = r; hi = r; }
      // which edge is the thinner hit: the one where the cue ball turns more off its line
      const turn = r => { const q = after(r); if (q.length < 6) return 0; const d = unit(sub(q[5], q[0])); return Math.acos(Math.max(-1, Math.min(1, dot(d, [Math.cos(w.ang), Math.sin(w.ang)])))); };
      const fanThin = lo && hi && lo !== hi ? (turn(lo) > turn(hi) ? 0 : 1) : null;
      const c0 = w.r.final.find(q => q.id === 0);
      const alts = all.slice(0, 4).map(c => ({ kind: c.kind, pocket: c.o ? c.o.pi : null, tip: c.b, side: c.a, power: c.p + 1, make: +c.pMake.toFixed(2), next: +c.pNext.toFixed(2), value: +c.value.toFixed(3) }));
      return { kind: w.kind, val: w.value, pocket: w.o ? w.o.pi : null, cut: Math.round(w.s.cut || 0), ghost: w.s.G, pts: after(w.r), pre: w.kind === 'kick' || w.kind === 'kick2' ? pathOf(w.r, 0, false) : null, ob: w.kind === 'bank' ? pathOf(w.r, A.n, true) : null,
        stroke: Object.assign(strokeOf(w.p, w.a, w.b), { hard: w.kind === 'safety' ? false : w.pMake < 0.6 || w.pNext < 0.5, jacked: !!out.jacked }),
        fan: lo && hi && lo !== hi ? [after(lo), after(hi)] : null, fanThin, p: c0 ? [c0.x, c0.y] : null, make: +w.pMake.toFixed(2), next: +w.pNext.toFixed(2), legal: w.legal != null ? +w.legal.toFixed(2) : null, opp: w.opp != null ? +w.opp.toFixed(2) : null,
        zone: +w.pNext.toFixed(2), robust: +w.pMake.toFixed(2), alts, alt: alt ? { kind: alt.kind, make: +alt.pMake.toFixed(2), value: +alt.value.toFixed(2) } : null };
    }
    // no clean pot on the lowest ball at all (V3.11.2, Nov 8 20:24: every pocket blocked or the cut too thin; the screen
    // showed nothing and the player could not tell what the plan wanted): said so
    function noShot(out) { if (inHand || (out.path && out.path.stroke)) return; out.noShot = { n: A.n, why: pA.length ? 'thin' : 'blocked' }; }
    // no shape to play for (the last ball, or no zone): still the shot line and a stroke that makes it
    function finishA(out) {
      const o = pA.find(q => q.pi === out.A.pocket), s = o ? shot(pt(cue), A, o, []) : null;
      const pl = sim && !inHand ? searchA(out, null) : null; if (!pl && !s) return;
      out.path = pl ? { shot: pl.kind, ghost: pl.ghost, pts: pl.pts, pre: pl.pre, ob: pl.ob, kind: pl.stroke.kind, s: pl.stroke.tip, cut: pl.cut, stroke: pl.stroke, fan: pl.fan, p: pl.p, make: pl.make, next: pl.next, legal: pl.legal, opp: pl.opp, alts: pl.alts, alt: pl.alt, noShape: true } : { ghost: s.G, pts: [], cut: Math.round(s.cut), noShape: true };
      if (pl && pl.pocket != null) out.A.pocket = pl.pocket;
    }
    const out = { L, W, R, order: ord.map(o => o.n), A: { n: A.n, pocket: null }, B: B ? { n: B.n, pocket: null } : null, C: C ? { n: C.n, pocket: null } : null, step: STEP, nx, ny, origin: [R, R], cells: null, path: null, spot: null, route: null };
    const pA = pocketsFor(A, []);
    const easiestA = () => { let best = null; for (const o of pA) { const s = shot(pt(cue), A, o, []); if (s && !s.blk.length && s.cut <= 70 && (!best || s.ease > best.e)) best = { e: s.ease, pi: o.pi }; } return best ? best.pi : pA.length ? pA[0].pi : null; };
    out.inHand = inHand;
    if (!B && !inHand) { out.A.pocket = easiestA(); finishA(out); noShot(out); out.ms = Date.now() - t0; return out; }
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
        // the chance of making it and being on the next one: the make, times how well it leaves the ball after (the wrong side
        // about half), less straight in (no control of the cue ball) and on a cushion (the cue raised)
        const rd = Math.min(X[0], L - X[0], X[1], W - X[1]), rail = rd < 2.5 ? 0.8 : rd < 4.5 ? 0.93 : 1;
        const v = pMake(s, o) * (Ub ? 0.55 + 0.45 * posC : 1) * (s.cut < 6 ? 0.9 : 1) * rail;
        sc[j * nx + i] = v; g[j * nx + i] = 9; n++; // graded below
      }
      const worth = Array.from(sc).sort((a, b) => b - a).slice(0, Math.round(150 / (STEP * STEP))).reduce((a, b) => a + b, 0);
      const z = { o, g, sc, worth }; zones.push(z); if (!bestZ || worth > bestZ.worth) bestZ = z;
    }
    if (!bestZ) { if (!inHand) { out.A.pocket = easiestA(); finishA(out); noShot(out); } out.ms = Date.now() - t0; return out; }
    // every pocket's zone graded against the best spot of all (V3.11: position counts for whichever pocket the ball is then
    // played in; the plan's pocket for it is the one the planned stroke leaves it best for)
    // the owner's bands (Nov 9): 1 green 90%+, 5 light green 80-90, 2 yellow 60-80, 3 red 50-60, 6 under 50; 4 a ball in the way
    for (const z of zones) for (let k = 0; k < nx * ny; k++) if (z.g[k] === 9) { const q = z.sc[k]; z.g[k] = q >= 0.9 ? 1 : q >= 0.8 ? 5 : q >= 0.6 ? 2 : q >= 0.5 ? 3 : 6; }
    const zv = (z, p) => { const k = idx(p); if (k < 0) return 0; const g = z.g[k]; return g && g !== 4 ? z.sc[k] : 0; };
    const zoneAt = p => Math.max(0, ...zones.map(z => zv(z, p))); out.zoneAt = null;
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
      if (pl) out.path = { shot: pl.kind, ghost: pl.ghost, pts: pl.pts, pre: pl.pre, ob: pl.ob, kind: pl.stroke.kind, s: pl.stroke.tip, cut: pl.cut, stroke: pl.stroke, fan: pl.fan || null, fanThin: pl.fanThin, p: pl.p, make: pl.make, next: pl.next, legal: pl.legal, opp: pl.opp, zone: pl.zone, robust: pl.robust, alts: pl.alts, alt: pl.alt };
      else finishA(out);
    }
    // the zone's spot the plan aims for, the shot on B from there and where the cue ball goes on to for C
    // the zone's good spots: green and light green (80%+), else the best there are (V3.12)
    let greens = []; for (let k = 0; k < nx * ny; k++) if (bestZ.g[k] === 1 || bestZ.g[k] === 5) greens.push([cx(k % nx), cy(Math.floor(k / nx)), bestZ.sc[k]]);
    if (!greens.length) { for (let k = 0; k < nx * ny; k++) if (bestZ.g[k] && bestZ.g[k] !== 4) greens.push([cx(k % nx), cy(Math.floor(k / nx)), bestZ.sc[k]]); greens = greens.sort((a, b) => b[2] - a[2]).slice(0, 30); }
    let sp = null;
    if (!inHand && pl && pl.p) sp = [pl.p[0], pl.p[1], 1]; // the perfect spot: where the planned stroke stops
    else if (inHand) { const d = q => Math.hypot(q[0] - A.x, q[1] - A.y); sp = greens.sort((a, b) => b[2] * Math.exp(-d(b) / 40) - a[2] * Math.exp(-d(a) / 40))[0]; }
    else if (pl) { // the best-graded spot within 6 in of where the planned path stops, inside the green
      const m = pl.pts[pl.pts.length - 1], d = q => Math.hypot(q[0] - m[0], q[1] - m[1]), inner = q => { const i = Math.floor((q[0] - R) / STEP), j = Math.floor((q[1] - R) / STEP); return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const ii = i + a, jj = j + b; return ii >= 0 && jj >= 0 && ii < nx && jj < ny && bestZ.g[jj * nx + ii] === 1; }); };
      const close = greens.filter(q => d(q) <= 6 && inner(q)); sp = close.length ? close.sort((a, b) => b[2] - a[2])[0] : greens.sort((a, b) => d(a) - d(b))[0]; }
    else sp = greens.sort((a, b) => b[2] - a[2])[0];
    if (sp) {
      const X = [sp[0], sp[1]], s2 = shot(X, Zb, bestZ.o, goneZ); out.spot = X; if (s2) (inHand ? out.A : out.B).cut = Math.round(s2.cut);
      if (inHand && s2) out.path = { ghost: s2.G, pts: [], inHand: true, make: +pMake(s2, bestZ.o).toFixed(2), next: +zv(bestZ, X).toFixed(2) };
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
    noShot(out);
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
      if (seen[k] || !want.includes(cells[k])) continue; const q = [k], ks = []; seen[k] = 1;
      while (q.length) { const c = q.pop(); ks.push(c); const i = c % nx, j = Math.floor(c / nx);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, n = b * nx + a; if (a < 0 || b < 0 || a >= nx || b >= ny || seen[n] || !want.includes(cells[n])) continue; seen[n] = 1; q.push(n); } }
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
    const ang = p => Math.atan2(p[1] - c[1], p[0] - c[0]);
    // the cone's middle: the spot's direction when the spot is in the green, else the green's own middle direction (V3.11.2:
    // the spot is where the planned stroke stops and can be outside the green; the cone came out empty and not a number)
    const mid = (() => { let sx = 0, sy = 0; for (const p of cells) { const a = ang(p); sx += Math.cos(a); sy += Math.sin(a); } return Math.atan2(sy, sx); })();
    const inGreen = pl.spot && cells.some(p => Math.abs(p[0] - pl.spot[0]) <= pl.step && Math.abs(p[1] - pl.spot[1]) <= pl.step);
    const ref = inGreen ? ang(pl.spot) : mid;
    const rel = p => { let a = ang(p) - ref; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const BIN = 2 * D2R, NB = 90, cnt = new Array(2 * NB + 1).fill(0), bin = a => Math.round(a / BIN) + NB;
    const ar = cells.map(p => ({ a: rel(p), r: Math.hypot(p[0] - c[0], p[1] - c[1]) }));
    for (const q of ar) { const b = bin(q.a); if (b >= 0 && b < cnt.length) cnt[b]++; }
    let lo = NB, hi = NB; const has = b => b >= 0 && b < cnt.length && cnt[b] > 0;
    while (has(lo - 1) || has(lo - 2)) lo--; while (has(hi + 1) || has(hi + 2)) hi++;
    const a0 = (lo - NB - 0.5) * BIN, a1 = (hi - NB + 0.5) * BIN, rs = ar.filter(q => q.a >= a0 && q.a <= a1).map(q => q.r).sort((x, y) => x - y);
    if (rs.length < 2) return null;
    const r0 = 2 * R + 0.5, r1 = Math.max(r0 + 2, rs[Math.min(rs.length - 1, Math.floor(rs.length * 0.95))]);
    const w = a1 - a0, e = Math.max(w * 0.1, 1.5 * D2R), A0 = ref + a0, A1 = ref + a1;
    const core = sector(c, r0, r1, A0 + e, A1 - e, Lt, Wt, R), sides = [sector(c, r0, r1, A0, A0 + e, Lt, Wt, R), sector(c, r0, r1, A1 - e, A1, Lt, Wt, R)];
    const line = [[c[0] + r0 * Math.cos(ref), c[1] + r0 * Math.sin(ref)], [c[0] + r1 * Math.cos(ref), c[1] + r1 * Math.sin(ref)]];
    return { core, sides, line, from: c, r0: +r0.toFixed(1), r1: +r1.toFixed(1), width: Math.round(w / D2R) };
  }
  function shapes(pl, B) {
    if (!pl.cells) return null;
    const keyOf = p => { const i = Math.floor((p[0] - pl.origin[0]) / pl.step), j = Math.floor((p[1] - pl.origin[1]) / pl.step); return j * pl.nx + i; };
    const g = pieces(pl, [1, 5]).filter(q => q.n >= 3);
    let main = pl.spot ? g.find(q => q.ks.includes(keyOf(pl.spot))) : null; if (!main) main = g.sort((a, b) => b.n - a.n)[0];
    const near = (a, b) => Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) < 14;
    const gp = main ? g.filter(q => q === main || (q.n >= 6 && near(q, main))) : [], green = gp.length ? [hull([].concat(...gp.map(q => q.poly)))] : []; // one shape
    const red = pieces(pl, [3]).sort((a, b) => b.n - a.n).slice(0, 2).filter(q => q.n >= 6).map(q => q.poly), yellow = pieces(pl, [2]).sort((a, b) => b.n - a.n).slice(0, 3).filter(q => q.n >= 6).map(q => q.poly);
    const blocked = pieces(pl, [4]).filter(q => q.n >= 6).map(q => q.poly);
    // how far the green reaches from the next ball (for the fade: strongest near the ball, lighter further away)
    let far = 0; for (const poly of green) for (const p of poly) far = Math.max(far, Math.hypot(p[0] - B.x, p[1] - B.y));
    return { green, red, yellow, blocked, from: [B.x, B.y], far, cone: gp.length ? cone(pl, gp, B, pl.L, pl.W, pl.R) : null };
  }
  // the grade of a cue-ball spot in a plan's zone: 'green' | 'amber' | 'red' | 'blocked' | null
  function gradeAt(pl, x, y) {
    if (!pl || !pl.cells) return null; const i = Math.floor((x - pl.origin[0]) / pl.step), j = Math.floor((y - pl.origin[1]) / pl.step);
    if (i < 0 || j < 0 || i >= pl.nx || j >= pl.ny) return null; return ({ 1: 'green', 5: 'lightgreen', 2: 'yellow', 3: 'red', 6: 'low', 4: 'blocked' })[pl.cells[j * pl.nx + i]] || null;
  }
  // the power scale (V3.11): power 1-10 as cue-ball speeds, mph
  const POWER_MPH = [0.9, 1.5, 2.1, 2.8, 3.5, 4.3, 5.3, 6.4, 7.8, 9.5]; // Dr. Dave's speeds (see plan)
  const powerOf = mph => { const m = POWER_MPH; if (mph <= m[0]) return mph / m[0]; for (let i = 1; i < m.length; i++) if (mph <= m[i]) return i + (mph - m[i - 1]) / (m[i] - m[i - 1]); return 10 + (mph - m[9]) / 2; };
  // the speed a lone cue ball was struck at, from where it started, its first direction and how far it went (in), in the
  // simulation (cushions included); for the power test
  function speedFor(start, dir, dist, P, b) {
    if (!sim) return null; let lo = 3, hi = 600; P = Object.assign({}, P, { pockets: [], cushionRoll: P.cushionRoll == null ? 0.6 : P.cushionRoll }); // (a roll into a pocket does not count)
    const len = v => { const r = sim([{ id: 0, x: start[0], y: start[1] }], { angle: Math.atan2(dir[1], dir[0]), speed: v, a: 0, b: b || 0 }, P, { record: true, maxT: 40 }), q = r.paths[0] || []; let s0 = 0; for (let i = 1; i < q.length; i++) s0 += Math.hypot(q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]); return s0; };
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (len(m) < dist) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  return { plan, gradeAt, POWER_MPH, powerOf, speedFor };
}
const COACH = coachFactory(typeof simulate !== 'undefined' ? simulate : typeof module !== 'undefined' ? require('../core.js').simulate : null);
if (typeof module !== 'undefined') module.exports = COACH;
