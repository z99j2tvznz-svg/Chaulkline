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
    // a ball read a little into the cushion (Nov 9 22:20: the 9 frozen on the rail read 0.3 in into it, so no pot along the
    // rail was found and the plan was a kick) is on the cloth, against the cushion
    balls = balls.map(b => Object.assign({}, b, { x: Math.max(R + 0.02, Math.min(L - R - 0.02, b.x)), y: Math.max(R + 0.02, Math.min(W - R - 0.02, b.y)) }));
    // the cushion's grip, from the player's spin test (V3.16; 0.25 measured on the owner's table, Nov 9 22:20)
    P = Object.assign({}, P, { railMu: o0.railMu > 0.05 && o0.railMu < 0.8 ? o0.railMu : P.railMu != null ? P.railMu : 0.25 });
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
    // aim error, turned into the object ball's error through the cut (a thinner cut magnifies it) and set against the
    // pocket's width seen from the ball (corner about 2.8 in wide, side 2 in, narrower from a steep entry), plus 0.6 degrees
    // on the object ball for stroke and throw. V3.16 (owner, Nov 10: a typical Fargo 550 until the player's own misses say
    // otherwise): 0.09 degrees on the cue ball's line. In the simulation that makes a straight-in with 3 ft each way about
    // 81%, a 30-degree cut 2.5 ft each way 77%, 45 degrees 61%, 4 ft to a ball 2 ft from the pocket at 15 degrees 87%.
    // (Before, 0.2 degrees: those were 44%, 45%, 36% and 47%, a weak player, not a pro.)
    // V3.17 (owner, Nov 10: the coaching teaches the next level up, not the player's own game): o0.level is the Fargo the
    // plan is made for (the app sends the player's own plus 100); 0.09 degrees at 550, halved every 150 points up
    const LEVEL = o0.level > 150 && o0.level < 950 ? o0.level : 550, AIM_SD = 0.09 * Math.pow(2, (550 - LEVEL) / 150) * D2R, OB_SD = 0.6 * D2R;
    const DIFF_K = Math.pow(2, (550 - LEVEL) / 300); // (hard strokes cost a weaker player more)
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
    // V3.15 (owner, Nov 9 21:33: soft, medium, hard are what a player can repeat): five speeds, the player's own soft, medium
    // and hard from the power test (Dr. Dave's 1.6, 3.2 and 6 mph until then) and the two between; the tip from the player's
    // own hardest draw to their hardest follow (the draw test; half a radius each way until then); side spin in tips, a tip
    // being what the spin test measured (0.17 of the radius until then), up to two tips in the search and three for the best
    const SP = o0.speeds && o0.speeds.length === 3 && o0.speeds.every(v => v > 0.3 && v < 15) ? o0.speeds : [1.6, 3.2, 6];
    // (V3.17: and very hard, half again the hard roll: a draw near break speed, owner Nov 10)
    const MPH = [SP[0], Math.sqrt(SP[0] * SP[1]), SP[1], Math.sqrt(SP[1] * SP[2]), SP[2], 1.5 * SP[2]], TRY = [0, 1, 2, 3, 4, 5];
    const SPEED_WORD = ['soft', 'soft to medium', 'medium', 'medium to hard', 'hard', 'very hard'];
    const TR = o0.tipRange || {}, BD = TR.draw < -0.1 && TR.draw > -0.8 ? TR.draw : -0.45, BF = TR.follow > 0.1 && TR.follow < 0.8 ? TR.follow : 0.45;
    const TIPS = [BD, BD / 2, 0, BF / 2, BF], TIP = o0.spinTip > 0.05 && o0.spinTip < 0.4 ? o0.spinTip : 0.17, SIDES = [-2, -1, 0, 1, 2].map(k => k * TIP);
    const init = () => [{ id: 0, x: cue.x, y: cue.y }].concat(objs.map(o => ({ id: o.n, x: o.x, y: o.y })));
    const run = (ang, v, a, b) => sim(init(), { angle: ang, speed: v, a, b }, P, { record: true, only: new Set([0]), maxT: 9 });
    const strokeOf = (p, a, b) => ({ tip: +b.toFixed(2), side: +a.toFixed(2), tips: Math.round(a / TIP), power: p + 1, mph: +MPH[p].toFixed(1), speed: SPEED_WORD[p], kind: b < -0.1 ? 'draw' : b > 0.1 ? 'follow' : 'center' });
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
      // (V3.15: side spin and extra cushions cost a little, not a lot: coming into the line with spin or more rails is good
      // position play, owner Nov 9 21:33)
      const simple = c => (c.p <= 3 ? 1 : c.p === 4 ? 0.95 : 0.9) * (1 - 0.02 * Math.abs(Math.round(c.a / TIP)));
      // a harder stroke is harder to make (V3.16, owner Nov 10: three tips of side with full draw on a thin cut is a hard make
      // even for a pro): the aim error grows with side spin (squirt and swerve the player has to allow for), with the tip far
      // from the middle and with speed past medium
      const diff = c => 1 + DIFF_K * (0.3 * Math.abs(Math.round(c.a / TIP)) + 1.2 * Math.max(0, Math.abs(c.b) - 0.25) + 0.12 * Math.max(0, c.p - 2));
      const rails = pts => { let n = 0, on = false; for (const p of pts) { const at = p[0] < R + 0.25 || p[0] > L - R - 0.25 || p[1] < R + 0.25 || p[1] > W - R - 0.25; if (at && !on) n++; on = at; } return n; };
      // (V3.16, owner Nov 10: more cushions are good position play when they bring the cue ball into the line; their risk is
      // in the runs with the player's errors already, so no cost of their own)
      const railF = r => 1;
      // a candidate's percentages: N runs with the player's errors
      const mc = (c, N) => {
        let made = 0, q = 0, legal = 0, opp = 0;
        for (let i = 0; i < N; i++) {
          const ea = gauss(R0) * AIM_SD * diff(c), ev = 1 + gauss(R0) * 0.08, es = gauss(R0) * 0.05, et = gauss(R0) * 0.05;
          const r = runAll(c.ang + ea, MPH[c.p] * 17.6 * ev, c.a + es, Math.max(-0.55, Math.min(0.55, c.b + et)), c.init);
          if (c.kind === 'safety') { const ok = r.firstHit === A.n && !r.pocketed.some(z => z.id === 0) && (r.railAfter || r.pocketed.length); if (ok) { legal++; opp += oppBest(r); } continue; }
          if (!potted(r)) continue; made++;
          // the leave with the balls where they may really be (the make is the player's, who sees the real balls; the cut and
          // so the cue ball's way are what the app may have wrong): the same stroke on the moved balls, aimed at the moved ghost
          let rq = r;
          if ((c.kind === 'pot' || c.kind === 'bank') && c.o && c.o.pk) {
            const balls = (c.init || init()).map(q => ({ id: q.id, x: q.x + gauss(R0) * POS_SD, y: q.y + gauss(R0) * POS_SD })), a1 = balls.find(q => q.id === A.n), c1 = balls[0];
            const tgt = c.kind === 'bank' ? mirror([c.o.pk.x, c.o.pk.y], c.cu) : [c.o.pk.x, c.o.pk.y], u = unit(sub(tgt, [a1.x, a1.y])), G = [a1.x - 2 * R * u[0], a1.y - 2 * R * u[1]];
            const r2 = runAll(Math.atan2(G[1] - c1.y, G[0] - c1.x) + (c.da || 0) + ea, MPH[c.p] * 17.6 * ev, c.a + es, Math.max(-0.55, Math.min(0.55, c.b + et)), balls);
            rq = r2.pocketed.some(z => z.id === 0) ? null : r2; // a scratch there: no leave
          }
          q += rq ? nextQ(rq) : 0;
        }
        // (V3.15: runs added to the candidate's earlier ones, so the final check pools them rather than replacing them)
        c.nN = (c.nN || 0) + N; c.nMade = (c.nMade || 0) + made; c.nQ = (c.nQ || 0) + q; c.nLegal = (c.nLegal || 0) + legal; c.nOpp = (c.nOpp || 0) + opp;
        if (c.kind === 'safety') { c.legal = c.nLegal / c.nN; c.opp = c.nLegal ? c.nOpp / c.nLegal : 1; c.value = 0.35 * c.legal * (1 - c.opp) * simple(c); c.pMake = 0; c.pNext = 0; return c; }
        // offence first: a sure pot with a poor leave (0.6) still beats the best safety (0.5); a 50/50 pot does not
        // (V3.13, Nov 8 20:50: plans made the ball and left the cue ball out of the zone): the leave counts more
        c.pMake = c.nMade / c.nN; c.pNext = c.nMade ? c.nQ / c.nMade : 0; c.value = c.pMake * (0.4 + 0.6 * c.pNext) * simple(c) * (c.rf || 1); return c;
      };
      // the aim in the middle of the angles that pot it (V3.16: the first angle found that pots can sit at the edge, where
      // half the player's small errors miss; a player allows for throw by feel and aims at the middle)
      const centre = c => {
        const go = d => { const r = runAll(c.ang + d * D2R, MPH[c.p] * 17.6, c.a, c.b, c.init); return potted(r) ? r : null; };
        let lo = 0, hi = 0; for (let d = -0.05; d >= -0.8; d -= 0.05) { if (!go(d)) break; lo = d; } for (let d = 0.05; d <= 0.8; d += 0.05) { if (!go(d)) break; hi = d; }
        const m = (lo + hi) / 2; if (Math.abs(m) < 0.015) return c; const r = go(m); if (!r) return c;
        return Object.assign(c, { ang: c.ang + m * D2R, da: (c.da || 0) + m * D2R, r });
      };
      const all = [];
      // 1. straight at A: every pocket, tip, speed (the nominal stroke first; the aim nudged up to a degree for throw)
      const direct = [];
      for (const o of pA) {
        const s = shot(pt(cue), A, o, []); if (!s || s.cut > 75) continue;
        // a ball in the way by less than the doubt about where it is (0.45 in; Nov 9 20:32, the 1 "blocked" by the 4 by a
        // quarter inch, the player saw it clear): tried with that ball moved just clear, and the plan says "tight"
        let ini = null, tight = [];
        if (s.blk.length) {
          const a0 = pt(cue), b0 = s.G, d = unit(sub(b0, a0)), nrm = [-d[1], d[0]];
          if (s.blk.some(q => segDist(pt(q), a0, b0) < 2 * R - 0.45)) continue;
          ini = init(); for (const q of s.blk) { const side = Math.sign(dot(sub(pt(q), a0), nrm)) || 1, need = 2 * R + 0.05 - segDist(pt(q), a0, b0), z = ini.find(t => t.id === q.n); z.x += nrm[0] * side * need; z.y += nrm[1] * side * need; tight.push(q.n); }
        }
        const ang0 = Math.atan2(s.G[1] - cue.y, s.G[0] - cue.x);
        const back = [-Math.cos(ang0), -Math.sin(ang0)], jack = objs.some(q => { const d = [q.x - cue.x, q.y - cue.y], t = dot(d, back); return t > 0 && t < 9 && Math.abs(d[0] * back[1] - d[1] * back[0]) < 1.9; });
        if (jack) out.jacked = true;
        // every speed, tip and side together (V3.15: side spin was tried only on the best three after the rest was chosen, so
        // spin to come into the line was hardly ever found). The aim that pots it (throw) found once for each speed and side
        // and tried first for the other tips
        for (const p of TRY) for (const a of SIDES) {
          let da0 = null;
          for (const b of TIPS) {
            if (jack && (b < 0 || p > 2)) continue; // (cue raised: no draw, medium at most)
            if (p === 5 && Math.abs(b) < 0.2) continue; // (very hard only for a real draw or follow)
            for (const da of da0 == null ? [0, 0.5, -0.5, 1, -1, 1.5, -1.5] : [da0, da0 + 0.5, da0 - 0.5]) { const r = runAll(ang0 + da * D2R, MPH[p] * 17.6, a, b, ini); if (potted(r)) { da0 = da; direct.push({ kind: 'pot', o, s, ang: ang0 + da * D2R, da: da * D2R, p, a, b, r, init: ini, tight, v0: nextQ(r) * railF(r) * (tight.length ? 0.9 : 1), rf: railF(r) * (tight.length ? 0.9 : 1) }); break; } }
          }
        }
      }
      const pre = c => c.v0 * simple(c);
      direct.sort((x, y) => pre(y) - pre(x));
      const top = direct.slice(0, 18).map(c => mc(centre(c), 10)); top.sort((x, y) => y.value - x.value);
      // the best three tried with a tip more side spin (three tips at most)
      for (const c of top.slice(0, 3)) { const k = Math.round(c.a / TIP); if (Math.abs(k) !== 2) continue; const a = Math.sign(k) * 3 * TIP;
        for (const da of [c.da / D2R, c.da / D2R + 0.5, c.da / D2R - 0.5, c.da / D2R + 1, c.da / D2R - 1]) { const ang = c.ang - c.da + da * D2R, r = runAll(ang, MPH[c.p] * 17.6, a, c.b, c.init); if (potted(r)) { top.push(mc({ kind: 'pot', o: c.o, s: c.s, ang, da: da * D2R, p: c.p, a, b: c.b, r, init: c.init, tight: c.tight, rf: railF(r) * (c.tight && c.tight.length ? 0.9 : 1) }, 12)); break; } }
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
          for (const p of [1, 2, 4]) for (const da of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1]) { const r = runAll(ang0 + da * D2R, MPH[p] * 17.6, 0, 0); if (potted(r)) { banks.push({ kind: 'bank', o: { pi, pk }, cu, s: { G, cut: 0 }, ang: ang0 + da * D2R, da: da * D2R, p, a: 0, b: 0, r, rf: railF(r) }); break; } }
        } });
        all.push(...banks.map(c => mc(centre(c), 10)));
      }
      // 3. kicks: the cue ball off one or two cushions to A's ghost (to pot it), or to A itself (to hit it)
      if (bestPot() < 0.4) {
        const targets = pA.map(o => ({ o, G: [A.x - 2 * R * o.u[0], A.y - 2 * R * o.u[1]] }));
        const kicks = [], tryKick = (Gm, o, k, rails2) => {
          const aim = sub(Gm, pt(cue)), ang0 = Math.atan2(aim[1], aim[0]);
          for (const p of [1, 2, 4]) for (const da of [0, 0.6, -0.6, 1.2, -1.2]) {
            const r = runAll(ang0 + da * D2R, MPH[p] * 17.6, 0, 0);
            if (potted(r)) { kicks.push({ kind: rails2 ? 'kick2' : 'kick', o, s: { G: Gm, cut: 0 }, ang: ang0 + da * D2R, p, a: 0, b: 0, r, rf: 1 }); return true; }
          }
          return false;
        };
        for (const t of targets) for (let cu = 0; cu < 4; cu++) tryKick(mirror(t.G, cu), t.o, cu, false);
        if (!kicks.length) for (const t of targets) for (const [c1, c2] of [[0, 2], [0, 3], [1, 2], [1, 3], [2, 0], [3, 0], [2, 1], [3, 1]]) tryKick(mirror(mirror(t.G, c1), c2), t.o, c1, true);
        all.push(...kicks.map(c => mc(centre(c), 10)));
      }
      // 4. safety: A hit softly, full or thin either side, straight or off a cushion when A cannot be seen; in the Coaching
      // test (runouts) only when no pot, bank or kick makes 40% (owner, Nov 9 20:32: three safeties rejected, a 70% pot there)
      if (Math.max(0, ...all.filter(c => c.kind !== 'safety').map(c => c.pMake || 0)) < 0.4) {
        const safe = [], see = !blockers(pt(cue), pt(A), [A.n]).length;
        const aims = see ? [0, 1, -1].map(k => { const d = unit(sub(pt(A), pt(cue))), n = [-d[1], d[0]]; return [A.x + n[0] * k * 1.8, A.y + n[1] * k * 1.8]; }) : [0, 1, 2, 3].map(cu => mirror(pt(A), cu));
        for (const T of aims) { const aim = sub(T, pt(cue)), ang0 = Math.atan2(aim[1], aim[0]);
          for (const p of [0, 1, 2]) for (const b of [-0.2, 0, 0.2]) { const r = runAll(ang0, MPH[p] * 17.6, 0, b); if (r.firstHit === A.n && !r.pocketed.some(z => z.id === 0) && (r.railAfter || r.pocketed.length)) safe.push({ kind: 'safety', o: null, s: { G: T, cut: 0 }, ang: ang0, p, a: 0, b, r, v0: 1 - oppBest(r) }); } }
        safe.sort((x, y) => y.v0 - x.v0); all.push(...safe.slice(0, 4).map(c => mc(c, 8)));
      }
      if (!all.length) return null;
      all.sort((x, y) => y.value - x.value);
      // the best three again with more runs before one is picked (a small sample flatters the lucky one)
      const fin = all.slice(0, 3).map(c => mc(c, 24)); fin.sort((x, y) => y.value - x.value); all.sort((x, y) => y.value - x.value);
      let w = fin[0];
      // (V3.18: of the strokes within 5% of the best, of its kind, the one whose stop is nearest the middle of the good stretch
      // of its line from the next ball: speed a little off either way still leaves it good)
      // (only strokes stopping within 14 in of the best one's stop: the same leave at a better speed, not another plan)
      if (zoneAt && w.kind !== 'safety') {
        const stopOf = c => { const z = c.r.final.find(q => q.id === 0); return z ? [z.x, z.y] : null; }, s0 = stopOf(w);
        // (along the zone of the pocket that leave is best for: the next ball's pocket stays the same)
        const zb = s0 ? zones.reduce((b, z) => (zv(z, s0) > zv(b, s0) ? z : b), zones[0]) : null;
        if (s0 && zb) { const cB = [Zb.x, Zb.y], run = lineRun(cB, Math.atan2(s0[1] - cB[1], s0[0] - cB[0]), p => zv(zb, p));
          if (run) { let bd = 1e9; for (const c of fin.concat(all)) { if (c.kind !== w.kind || c.value < 0.95 * fin[0].value) continue; const p = stopOf(c); if (!p || Math.hypot(p[0] - s0[0], p[1] - s0[1]) > 14) continue; const d = Math.hypot(p[0] - run.mid[0], p[1] - run.mid[1]); if (d < bd) { bd = d; w = c; } } } }
      }
      const alt = fin.concat(all).find(c => c.kind !== w.kind);
      // the band of the cue ball's path: the same stroke aimed to the inside and to the outside of the pocket (A still in)
      let lo = null, hi = null, dlo = 0, dhi = 0;
      if (w.kind !== 'safety') for (let d = -2; d <= 2.001; d += 0.25) { const r = runAll(w.ang + d * D2R, MPH[w.p] * 17.6, w.a, w.b, w.init); if (!potted(r)) continue; if (!lo) { lo = r; dlo = d; } hi = r; dhi = d; }
      // which edge is the thinner hit (V3.14, owner Nov 9: the labels read backwards): the run whose object ball leaves at the
      // bigger angle to the cue ball's line, the cut (thinner = overcut); the cue ball's own turn says nothing (with stun a
      // thinner hit turns it less)
      const cutOf = (r, ang) => { const q = pathOf(r, A.n, true); if (q.length < 3) return 0; const d = unit(sub(q[Math.min(q.length - 1, 4)], q[0])); return Math.acos(Math.max(-1, Math.min(1, dot(d, [Math.cos(ang), Math.sin(ang)])))); };
      const fanThin = lo && hi && lo !== hi ? (cutOf(lo, w.ang + dlo * D2R) > cutOf(hi, w.ang + dhi * D2R) ? 0 : 1) : null;
      const c0 = w.r.final.find(q => q.id === 0);
      const alts = all.slice(0, 4).map(c => ({ kind: c.kind, pocket: c.o ? c.o.pi : null, tip: +c.b.toFixed(2), side: +c.a.toFixed(2), tips: Math.round(c.a / TIP), power: c.p + 1, speed: SPEED_WORD[c.p], make: +c.pMake.toFixed(2), next: +c.pNext.toFixed(2), value: +c.value.toFixed(3) }));
      return { kind: w.kind, val: w.value, pocket: w.o ? w.o.pi : null, cut: Math.round(w.s.cut || 0), ghost: w.s.G, pts: after(w.r), pre: w.kind === 'kick' || w.kind === 'kick2' ? pathOf(w.r, 0, false) : null, ob: w.kind !== 'safety' ? pathOf(w.r, A.n, true) : null, tight: w.tight && w.tight.length ? w.tight : null,
        stroke: Object.assign(strokeOf(w.p, w.a, w.b), { hard: w.kind === 'safety' ? false : w.pMake < 0.6 || w.pNext < 0.5, jacked: !!out.jacked }),
        fan: lo && hi && lo !== hi ? [after(lo), after(hi)] : null, fanThin, p: c0 ? [c0.x, c0.y] : null, make: +w.pMake.toFixed(2), next: +w.pNext.toFixed(2), legal: w.legal != null ? +w.legal.toFixed(2) : null, opp: w.opp != null ? +w.opp.toFixed(2) : null,
        zone: +w.pNext.toFixed(2), robust: +w.pMake.toFixed(2), alts, alt: alt ? { kind: alt.kind, make: +alt.pMake.toFixed(2), value: +alt.value.toFixed(2) } : null };
    }
    // The good stretch of a line from the next ball (V3.18): every inch out from the ball to the cushion, the zone's value;
    // the run of good values (within 0.25 of the line's best and 60%+, or 80% of the best when that is under 60%) holding
    // the best one, and its middle: where to send the cue ball, so a little long or short still leaves it good (owner, Nov 10:
    // "pick the median")
    function lineRun(c, a0, q) {
      const at = r => [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], rs = [];
      for (let r = 2 * R + 0.5; r <= 80; r += 1) { const p = at(r); if (p[0] < R || p[0] > L - R || p[1] < R || p[1] > W - R) break; rs.push([r, q(p)]); }
      if (!rs.length) return null; let bi = 0; rs.forEach((v, k) => { if (v[1] > rs[bi][1]) bi = k; }); const Qm = rs[bi][1]; if (Qm <= 0) return null;
      const T = Qm >= 0.6 ? Math.max(0.6, Qm - 0.25) : Qm * 0.8; let k0 = bi, k1 = bi;
      while (k0 > 0 && rs[k0 - 1][1] >= T) k0--; while (k1 < rs.length - 1 && rs[k1 + 1][1] >= T) k1++;
      const r0 = rs[k0][0], r1 = rs[k1][0], rm = (r0 + r1) / 2;
      return { r0, r1, rm, T, Qm, mid: at(rm), at };
    }
    // The zone as a fan along the planned leave's line from the next ball (V3.18, owner Nov 10: longer, so it shows how good
    // it is further out and how it narrows nearer the ball): the good stretch of that line in rings, each as wide as the
    // window where the next shot stays good at its distance (at most 30 degrees in all, leaning to the good side) and
    // coloured by the next shot's percentage there; the middle of the stretch is the target
    function zoneFan(Bb, sp) {
      if (!sp || !bestZ || !Bb) return null;
      const c = [Bb.x, Bb.y], d0 = Math.hypot(sp[0] - c[0], sp[1] - c[1]), a0 = Math.atan2(sp[1] - c[1], sp[0] - c[0]); if (d0 < 2 * R + 1) return null;
      const q = p => zv(bestZ, p), run = lineRun(c, a0, q); if (!run) return null;
      let { r0, r1 } = run; if (r1 - r0 < 4) { r0 = Math.max(2 * R + 0.5, r0 - 2); r1 += 2; }
      const pAt = (a, r) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], N = Math.max(3, Math.min(10, Math.round((r1 - r0) / 4))), rings = [];
      let LO = 0, HI = 0;
      for (let k = 0; k < N; k++) {
        const ra = r0 + (r1 - r0) * k / N, rb = r0 + (r1 - r0) * (k + 1) / N, rm = (ra + rb) / 2; let lo = 0, hi = 0;
        for (let d = 1; d <= 28; d++) { if (q(pAt(a0 + d * D2R, rm)) >= run.T) hi = d; else break; }
        for (let d = 1; d <= 28; d++) { if (q(pAt(a0 - d * D2R, rm)) >= run.T) lo = d; else break; }
        lo = Math.max(lo, 1.5); hi = Math.max(hi, 1.5); while (lo + hi > 30) { if (lo > hi) lo--; else hi--; }
        LO = Math.max(LO, lo); HI = Math.max(HI, hi);
        rings.push({ poly: sector(c, ra, rb, a0 - lo * D2R, a0 + hi * D2R, L, W, R), q: +q(pAt(a0, rm)).toFixed(2), lo, hi, r: +rm.toFixed(1) });
      }
      return { rings, line: [pAt(a0, r0), pAt(a0, r1)], from: c, spot: sp, ideal: run.mid, lo: LO, hi: HI, r0: +r0.toFixed(1), r1: +r1.toFixed(1), rm: +run.rm.toFixed(1), q0: +q(sp).toFixed(2), qmax: +run.Qm.toFixed(2) };
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
        // and closer is better (V3.18, owner Nov 10: plans left the cue ball 4-5 ft away, a 90% make at the coached level, so
        // near and far looked alike): up to 30 in from the ball is best, 6 ft away counts half (the next speed is harder to
        // judge from far), under 5 in is cramped
        // (and the object ball's own run: past 3 ft to the pocket the speed for the next position is harder to judge too)
        const comfort = (s.dl < 5 ? 0.85 : s.dl <= 30 ? 1 : Math.max(0.5, 1 - 0.5 * (s.dl - 30) / 42)) * (o.dist <= 36 ? 1 : Math.max(0.85, 1 - 0.15 * (o.dist - 36) / 36));
        const v = pMake(s, o) * (Ub ? 0.55 + 0.45 * posC : 1) * (s.cut < 6 ? 0.9 : 1) * rail * comfort;
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
      if (pl) out.path = { shot: pl.kind, ghost: pl.ghost, pts: pl.pts, pre: pl.pre, ob: pl.ob, kind: pl.stroke.kind, s: pl.stroke.tip, cut: pl.cut, stroke: pl.stroke, fan: pl.fan || null, fanThin: pl.fanThin, tight: pl.tight, p: pl.p, make: pl.make, next: pl.next, legal: pl.legal, opp: pl.opp, zone: pl.zone, robust: pl.robust, alts: pl.alts, alt: pl.alt };
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
    out.zoneFan = zoneFan(Zb, out.spot); out.target = out.zoneFan ? out.zoneFan.ideal : out.spot;
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
  // ---- the stroke tests (V3.15, owner Nov 9 21:33): what the player's spin and draw do on their table, in the simulation's
  // own terms, so the plan asks for strokes the player has ----
  const pathLen = q => { let s0 = 0; for (let i = 1; i < q.length; i++) s0 += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); return s0; };
  // a direction from point i of a path to the first point at least d further along (null when there is none)
  const dirFrom = (q, i, d) => { for (let j = i + 1; j < q.length; j++) { const v = [q[j][0] - q[i][0], q[j][1] - q[i][1]], l = Math.hypot(v[0], v[1]); if (l >= d) return [v[0] / l, v[1] / l]; } return null; };
  // where a lone cue ball rolled up the table met the short cushion: its way in and its way out (pts [[x, y]...])
  function railBounce(q, P) {
    if (q.length < 3) return null; const din = dirFrom(q, 0, 4); if (!din || Math.abs(din[0]) < 0.8) return null; // up the table, not across
    // the first time it comes back off that cushion (a hard roll goes round the table and meets it again)
    let k = 0; for (let i = 1; i < q.length; i++) { const f = din[0] > 0 ? q[i][0] - q[k][0] : q[k][0] - q[i][0]; if (f > 0) k = i; else if (f < -2) break; }
    const rail = din[0] > 0 ? P.L - P.R : P.R; if (Math.abs(q[k][0] - rail) > 4 || k === q.length - 1) return null; // never reached it
    let j0 = 0; for (let i = 0; i < k; i++) if (Math.abs(q[i][0] - rail) > 5) j0 = i; // the last point clear of the cushion on the way in
    const vin = [q[j0][0] - q[0][0], q[j0][1] - q[0][1]], li = Math.hypot(vin[0], vin[1]), dout = dirFrom(q, k, 8);
    if (li < 6 || !dout) return null;
    const ain = Math.atan2(vin[1] / li, Math.abs(vin[0] / li)) / D2R, aout = Math.atan2(dout[1], Math.abs(dout[0])) / D2R;
    return { k, ain, aout, turn: aout - ain, rail: din[0] > 0 ? 'right' : 'left' };
  }
  // the spin test: the side spin (fraction of the radius, signed) that turns the simulated roll off the cushion as the real one
  // turned, at the player's speed for that roll
  function fitSpin(q, mph, P) {
    if (!sim) return null; const real = railBounce(q, P); if (!real) return null; P = Object.assign({}, P, { pockets: [], cushionRoll: P.cushionRoll == null ? 0.6 : P.cushionRoll });
    const ang = Math.atan2(q[Math.max(1, real.k - 1)][1] - q[0][1], q[Math.max(1, real.k - 1)][0] - q[0][0]); let best = null;
    for (let a = -0.8; a <= 0.801; a += 0.02) {
      const r = sim([{ id: 0, x: q[0][0], y: q[0][1] }], { angle: ang, speed: mph * 17.6, a, b: 0 }, P, { record: true, maxT: 20 }), sq = (r.paths[0] || []).map(z => [z[1], z[2]]), sb = railBounce(sq, P);
      if (!sb) continue; const e = Math.abs(sb.turn - real.turn); if (!best || e < best.e - 0.05) best = { a: +a.toFixed(2), e };
    }
    return best ? { a: best.a, err: +best.e.toFixed(1), ain: +real.ain.toFixed(1), aout: +real.aout.toFixed(1), turn: +real.turn.toFixed(1), rail: real.rail } : null;
  }
  // the draw test: a straight shot (cue ball at c0 to the object ball at o0); the tip (fraction of the radius, + follow, - draw)
  // that leaves the simulated cue ball where the real one stopped. The speed: from how far the object ball went when it
  // stayed on the table, else the player's speed for that stroke
  function fitDraw(c0, cEnd, o0, oEnd, oLen, oIn, mph, P, side) {
    if (!sim) return null; P = Object.assign({}, P, { cushionRoll: P.cushionRoll == null ? 0.6 : P.cushionRoll });
    const ang = Math.atan2(o0[1] - c0[1], o0[0] - c0[0]), run = (v, b) => sim([{ id: 0, x: c0[0], y: c0[1] }, { id: 1, x: o0[0], y: o0[1] }], { angle: ang, speed: v, a: 0, b }, P, { record: true, maxT: 30 });
    // (for each tip the speed that sends the object ball as far as it went: a drawn ball slides and slows more on its way)
    const speedAt = b => { if (oIn || !(oLen > 6)) return mph * 17.6; let lo = 10, hi = 500; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2, r = run(m, b), q = (r.paths[1] || []).map(z => [z[1], z[2]]); if (r.pocketed.some(z => z.id === 1) || pathLen(q) > oLen) hi = m; else lo = m; } return (lo + hi) / 2; };
    let best = null;
    // (V3.16: compared along the shot's line only: the real shot is never quite straight, so the cue ball ends a little to
    // one side, which no tip on a straight shot reproduces)
    const u = [Math.cos(ang), Math.sin(ang)], hit = [o0[0] - 2 * P.R * u[0], o0[1] - 2 * P.R * u[1]], alongOf = p => (p[0] - hit[0]) * u[0] + (p[1] - hit[1]) * u[1], want = alongOf(cEnd);
    // (side: 'draw' or 'follow', the stroke asked: a follow that comes back off a cushion can end where a stop shot does)
    for (let b = side === 'follow' ? -0.04 : -0.8; b <= (side === 'draw' ? 0.041 : 0.801); b += 0.04) { const v = speedAt(b), r = run(v, b), c = r.final.find(z => z.id === 0); if (!c) continue; const e = Math.abs(alongOf([c.x, c.y]) - want); if (!best || e < best.e - 0.05) best = { b: +b.toFixed(2), e, v }; }
    const v = best ? best.v : mph * 17.6;
    return best ? { b: best.b, err: +best.e.toFixed(1), mph: +(v / 17.6).toFixed(1), along: +((cEnd[0] - hit[0]) * u[0] + (cEnd[1] - hit[1]) * u[1]).toFixed(1) } : null;
  }
  // the spin test's rolls together (V3.16): the cushion's grip (railMu) and one tip's side spin that turn simulated rolls
  // off the cushion as the real ones turned (rolls: [{k tips, mph, turn degrees}]). On the owner's table (Nov 9 22:20,
  // 18 rolls): grip 0.25 and a tip 0.13 of the radius, within 6 degrees a roll on average, about the scatter between the
  // owner's own repeats
  function fitSpinAll(rolls, P) {
    if (!sim || !rolls || rolls.length < 3) return null; let best = null;
    const turnOf = (a, mph, mu) => { const Q = Object.assign({}, P, { pockets: [], cushionRoll: 0.6, railMu: mu }); const r = sim([{ id: 0, x: Q.L * 0.75, y: Q.W / 2 }], { angle: 0, speed: mph * 17.6, a, b: 0 }, Q, { record: true, maxT: 6 }); const b = railBounce((r.paths[0] || []).map(z => [z[1], z[2]]), Q); return b ? Math.abs(b.turn) : null; };
    for (const mu of [0.15, 0.2, 0.25, 0.3, 0.4]) for (let T = 0.08; T <= 0.241; T += 0.02) {
      let e = 0; for (const q of rolls) { const t = turnOf(T * q.k, q.mph, mu); e += t == null ? 15 : Math.min(15, Math.abs(t - Math.abs(q.turn))); }
      if (!best || e < best.e) best = { railMu: mu, tip: +T.toFixed(2), e };
    }
    return { railMu: best.railMu, tip: best.tip, err: +(best.e / rolls.length).toFixed(1) };
  }
  return { plan, gradeAt, POWER_MPH, powerOf, speedFor, railBounce, fitSpin, fitSpinAll, fitDraw };
}
const COACH = coachFactory(typeof simulate !== 'undefined' ? simulate : typeof module !== 'undefined' ? require('../core.js').simulate : null);
if (typeof module !== 'undefined') module.exports = COACH;
