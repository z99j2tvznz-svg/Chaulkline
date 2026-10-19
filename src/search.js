// Experimental 9-ball shot recommender with lookahead (v2). Suggestion only; not part of the app build.
// Reuses core.js (V1.8.1): simulate (full-table physics for every trial), planGen (extra first-shot candidates),
// shotGrade / bestEase (position and safety heuristics), and runout.js pocketOptions. The Monte Carlo here is a seeded
// copy of core.js mcGen's method, so results repeat exactly; core.js itself is untouched.
//
// How a shot is valued (all model numbers, never real make rates):
//   value(shot) = pMake x future
//   pMake  - share of noisy repeats (stroke error below) that make the ball legally
//   future - the value of the best next shot from where the balls end up, searched `depth` shots ahead (to the end
//            when `endgame` balls or fewer are left). At the first shot it is averaged over several landing spots
//            (the nominal one plus noisy made repeats), so a shot whose cue ball scatters into bad spots scores lower.
//            Past the search horizon the next position is rated by V1 shotGrade (green 1, amber .7, red .35, none .15);
//            that is the only grade-based step, and the endgame never reaches it. 1 after the 9.
// Stroke error grows with what the shot demands: aim error with side spin, speed error with strength, spin error with
// spin. That is how harder shots cost more: they fail more often in the model, not through invented penalties.
// Safeties are searched and reported separately; their quality is 1 - the opponent's easiest pot (core bestEase), a heuristic.
'use strict';
(function (root) {
const core = typeof module !== 'undefined' ? require('./core.js') : root;
const ST = typeof module !== 'undefined' ? require('./state.js') : root.chalkState;
const RO = typeof module !== 'undefined' ? require('./runout.js') : root.chalkRunout;
const D2R = Math.PI / 180, POS = [0.15, 0.35, 0.7, 1];

const BUDGETS = {
  server: { pockets: 2, levels: [2, 3, 4.5, 6, 8], spins: [-0.4, -0.2, 0, 0.25, 0.45], deepLevels: [2.5, 4, 6], deepSpins: [-0.3, 0, 0.35],
            screen: 6, screenN: 10, rootK: 4, childK: 3, depth: 3, endgame: 3, finalK: 3, finalN: 75, landings: 3, planGen: true,
            safeties: 3, safetyN: 10, safetyFinalN: 50 },
  phone:  { pockets: 2, levels: [2, 3.5, 5, 7], spins: [-0.35, 0, 0.35], deepLevels: [3, 5], deepSpins: [-0.3, 0.3],
            screen: 4, screenN: 8, rootK: 3, childK: 2, depth: 3, endgame: 3, finalK: 2, finalN: 50, landings: 2, planGen: false,
            safeties: 2, safetyN: 8, safetyFinalN: 30 },
};
const NOISE = { aimDeg: 0.35, speed: 0.08, speedPerLevel: 0.01, spin: 0.04, spinPer: 0.1, sideAim: 0.5 };
// Choosing a safety over offense (heuristic, reported with every recommendation)
const RULE = { offenseMinMake: 0.45, safetyMinQuality: 0.6, safetyMinLegal: 0.8 };

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function hashLayout(balls) { let h = 2166136261; for (const b of balls) for (const v of [b.id, Math.round(b.x * 100), Math.round(b.y * 100)]) { h ^= v; h = Math.imul(h, 16777619); } return h >>> 0; }
const level = (shot, P) => shot.speed / (1.6 * core.MPH);
// One noisy execution of `shot` under stroke-error model `nz`.
function noisy(shot, r, nz = NOISE) {
  const L = shot.speed / (1.6 * core.MPH), sa = Math.abs(shot.a || 0), sb = Math.abs(shot.b || 0);
  const clamp = v => Math.max(-0.5, Math.min(0.5, v));
  return { angle: shot.angle + gauss(r) * nz.aimDeg * (1 + nz.sideAim * sa / 0.25) * D2R, speed: shot.speed * Math.max(0.3, 1 + gauss(r) * (nz.speed + nz.speedPerLevel * L)),
           a: clamp((shot.a || 0) + gauss(r) * (nz.spin + nz.spinPer * sa)), b: clamp((shot.b || 0) + gauss(r) * (nz.spin + nz.spinPer * sb)) };
}

function makeCtx(P, budget, seed) { return { P, B: budget, sims: 0, seed }; }
function sim(ctx, balls, shot, rec, only) { ctx.sims++; return core.simulate(balls, shot, ctx.P, rec ? { record: true } : only != null ? { record: true, only: new Set([only]), sampleDt: 0.01 } : undefined); }
// Signed angle between the object ball's departure direction and the line to the pocket centre (null if not hit).
function objErr(r, tb, pk) {
  const p = r.paths[tb.id]; if (!p) return null;
  const q = p.find(s => Math.hypot(s[1] - tb.x, s[2] - tb.y) > 2.5); if (!q) return null;
  const a = Math.atan2(q[2] - tb.y, q[1] - tb.x), want = Math.atan2(pk.y - tb.y, pk.x - tb.x);
  let d = a - want; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d;
}
const lowest = balls => { let m = null; for (const b of balls) if (b.id > 0 && (m == null || b.id < m.id)) m = b; return m; };
// Legal 9-ball pot of `tid`: it is hit first, it goes in, the cue ball stays up.
const legalMake = (r, tid) => r.firstHit === tid && r.pocketed.some(p => p.id === tid) && !r.pocketed.some(p => p.id === 0);
function after(balls, r) { const gone = new Set(r.pocketed.map(p => p.id)); return r.final.filter(b => !gone.has(b.id)); }

// Position quality for the next ball from cue spot (x, y): best shotGrade over the next ball's reachable pockets.
function posGrade(left, x, y, P) {
  const n = lowest(left); if (!n) return { q: 3, cut: 0 };
  let q = 0, cut = null, hooked = false;
  for (const o of RO.pocketOptions(n, left.filter(b => b.id > 0), P)) {
    const sg = core.shotGrade(x, y, { tb: n, tid: n.id, pks: [o.pk] }, left, P);
    if (sg.hooked) hooked = true;
    if (sg.q > q) { q = sg.q; cut = Math.acos(Math.max(-1, Math.min(1, sg.g.cosCut))) / D2R; }
  }
  return { q, cut, hooked: !q && hooked };
}

// Candidate pots on the lowest ball: top `pockets` reachable pockets x strengths x follow/draw, aimed by ghost ball and
// corrected for throw once per pocket. Every trial is a full-table simulation.
function genPots(ctx, balls, deep) {
  const P = ctx.P, B = ctx.B, cue = balls.find(b => b.id === 0), tb = lowest(balls); if (!cue || !tb) return [];
  const objs = balls.filter(b => b.id > 0), out = [];
  // pockets the ball can reach, ranked by V1's pot ease from where the cue ball is (cut and distances), cue lane clear
  const others = balls.filter(b => b.id !== 0 && b.id !== tb.id), opts = [];
  for (const o of RO.pocketOptions(tb, objs, P)) {
    const g = core.potGeom(cue, tb, o.pk, P.R), cut = Math.acos(Math.max(-1, Math.min(1, g.cosCut))) / D2R;
    if (cut > 75 || g.cl < 0.3) continue;
    if (others.some(b => segDist(b.x, b.y, cue.x, cue.y, g.gx, g.gy) < 2 * P.R - 0.12)) continue;   // cue lane blocked
    opts.push({ ...o, g, cut, e: g.cosCut * g.cosCut * Math.exp(-(g.cl + 2.5 * g.vl) / 260) * (o.pk.corner ? 1 : 0.82) });
  }
  opts.sort((a, b) => b.e - a.e);
  for (const o of opts.slice(0, B.pockets)) {
    const g = o.g, cut = o.cut;
    // Aim at the middle of the pocket, not just anywhere that drops: measure the object ball's departure error from the
    // pocket centre and correct (secant step), once per pocket at a medium stroke, then once more per stroke for throw.
    const err = (ang, L, b) => { const r = ctx.P && sim(ctx, balls, { angle: ang, speed: L * 1.6 * core.MPH, a: 0, b }, false, tb.id); return objErr(r, tb, o.pk); };
    const a0 = g.ang, e0 = err(a0, 4, 0), e1 = err(a0 + 0.3 * D2R, 4, 0);
    if (e0 == null || e1 == null || Math.abs(e1 - e0) < 1e-6) continue;
    const k = (e1 - e0) / (0.3 * D2R), aim = a0 - e0 / k;
    for (const L of deep ? B.deepLevels : B.levels) for (const b of deep ? B.deepSpins : B.spins) {
      const e = err(aim, L, b), ang = e == null ? aim : aim - e / k, shot = { angle: ang, speed: L * 1.6 * core.MPH, a: 0, b }, r = sim(ctx, balls, shot);
      if (!legalMake(r, tb.id)) continue;
      out.push({ kind: 'pot', target: tb.id, pocket: o.pi, shot, cut, cueDist: g.cl, objDist: g.vl, res: r });
    }
  }
  return out;
}
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

// Noisy repeats of one candidate: make share, the share of made repeats leaving a playable (green/amber) next shot,
// and up to `keep` of the made repeats' layouts for averaging the future over landing spots.
function evalNoisy(ctx, balls, c, N, salt, keep = 0) {
  const r = rng(ctx.seed ^ salt ^ hashLayout(balls)); let made = 0, good = 0; const lays = [];
  for (let i = 0; i < N; i++) {
    const res = sim(ctx, balls, noisy(c.shot, r));
    if (!legalMake(res, c.target)) continue;
    made++;
    const left = after(balls, res), cue = left.find(b => b.id === 0), end = !left.some(b => b.id > 0) || res.pocketed.some(p => p.id === 9);
    if (end || posGrade(left, cue.x, cue.y, ctx.P).q >= 2) good++;
    if (lays.length < keep) lays.push({ left, end });
  }
  return { pMake: made / N, playable: made ? good / made : 0, n: N, lays };
}
// Horizon rating of a position (no more search): V1 shotGrade of the cue ball for the next ball.
function horizon(ctx, left) { const cue = left.find(b => b.id === 0); return left.some(b => b.id > 0) ? POS[posGrade(left, cue.x, cue.y, ctx.P).q] : 1; }

// Best value of the position `balls` with `left` more shots to search.
function nodeValue(ctx, balls, left, width) {
  if (!balls.some(b => b.id > 0)) return 1;
  if (left <= 0) return horizon(ctx, balls);
  const cands = genPots(ctx, balls, true); if (!cands.length) return 0;
  rankNominal(ctx, balls, cands);
  const scr = cands.slice(0, ctx.B.screen);
  for (const c of scr) c.ev = evalNoisy(ctx, balls, c, ctx.B.screenN, 7);
  scr.sort((a, b) => b.ev.pMake * b.quickPos - a.ev.pMake * a.quickPos);
  let best = 0;
  for (const c of scr.slice(0, width)) {
    if (!c.ev.pMake) continue;
    const done = c.res.pocketed.some(p => p.id === 9);
    best = Math.max(best, c.ev.pMake * (done ? 1 : nodeValue(ctx, after(balls, c.res), left - 1, Math.max(1, width - 1))));
  }
  return best;
}
// Cheap order before the noisy screen: nominal position quality for the next ball x V1's geometric pot ease
// (core bestEase formula: cos^2(cut) x distance falloff). Easy pots with poor shape and harder pots with good shape both rank.
function rankNominal(ctx, balls, cands) {
  for (const c of cands) {
    const left = after(balls, c.res), cue = left.find(b => b.id === 0);
    c.nom = !left.some(b => b.id > 0) || c.res.pocketed.some(p => p.id === 9) ? { q: 3 } : posGrade(left, cue.x, cue.y, ctx.P);
    const pk = ctx.P.pockets[c.pocket], cc = Math.cos((c.cut || 0) * D2R);
    c.ease = cc * cc * Math.exp(-((c.cueDist || 0) + 2.5 * (c.objDist || 0)) / 260) * (pk && pk.corner ? 1 : 0.82);
    c.quickPos = POS[c.nom.q]; c.quick = c.quickPos * c.ease;
  }
  cands.sort((a, b) => b.quick - a.quick);
}

// Safeties on the lowest ball: hit it first, no foul, nothing in; quality = 1 - opponent's easiest pot (heuristic).
function genSafeties(ctx, balls) {
  const P = ctx.P, cue = balls.find(b => b.id === 0), tb = lowest(balls); if (!cue || !tb) return [];
  const d = Math.hypot(tb.x - cue.x, tb.y - cue.y), base = Math.atan2(tb.y - cue.y, tb.x - cue.x), half = Math.asin(Math.min(1, 2 * P.R / Math.max(d, 2 * P.R + 0.1))) * 0.9;
  const out = [];
  for (let k = -4; k <= 4; k++) for (const L of [1.5, 2.5, 3.5]) for (const b of [0, -0.3]) {
    const shot = { angle: base + half * k / 4, speed: L * 1.6 * core.MPH, a: 0, b }, r = sim(ctx, balls, shot);
    const q = safetyQuality(r, tb.id, P); if (q == null) continue;
    out.push({ kind: 'safety', target: tb.id, shot, res: r, nomQuality: q });
  }
  return out.sort((a, b) => b.nomQuality - a.nomQuality);
}
function safetyQuality(r, tid, P) {
  if (r.firstHit !== tid || r.pocketed.length || !r.railAfter) return null;   // not a legal, clean safety
  const left = r.final, n = lowest(left); if (!n) return null;
  return 1 - Math.min(1, core.bestEase(left, [n.id], P));
}
function evalSafety(ctx, balls, c, N, salt) {
  const r = rng(ctx.seed ^ salt ^ hashLayout(balls)); let legal = 0, q = 0;
  for (let i = 0; i < N; i++) { const v = safetyQuality(sim(ctx, balls, noisy(c.shot, r)), c.target, ctx.P); if (v != null) { legal++; q += v; } }
  return { pLegal: legal / N, quality: legal ? q / legal : 0, n: N };
}

function describe(c, P) {
  const lv = level(c.shot, P), path = c.path || [];
  let travel = 0; for (let i = 1; i < path.length; i++) travel += Math.hypot(path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
  return { strength: +lv.toFixed(1), follow: +(c.shot.b || 0).toFixed(2), side: +(c.shot.a || 0).toFixed(2), cut: c.cut == null ? null : +c.cut.toFixed(0),
           cueToBall: c.cueDist == null ? null : +c.cueDist.toFixed(0), ballToPocket: c.objDist == null ? null : +c.objDist.toFixed(0), cueTravel: path.length ? +travel.toFixed(0) : null };
}

// Recommend one shot for a confirmed (or hypothetical) table state.
function recommend(s, opts = {}) {
  const t0 = Date.now(), B = typeof opts.budget === 'object' ? opts.budget : BUDGETS[opts.budget || 'server'];
  const lay = ST.plannerLayout(s, opts.minConf == null ? 0.9 : opts.minConf);
  if (!lay.ok) return { error: 'not every ball is confirmed: ' + lay.doubtful.join(', ') };
  const P = ST.physicsOf(s), balls = lay.balls, ctx = makeCtx(P, B, opts.seed == null ? hashLayout(balls) : opts.seed);
  const objs = balls.filter(b => b.id > 0), depth = objs.length <= B.endgame ? objs.length : B.depth, width = objs.length <= B.endgame ? B.rootK : B.childK;
  // 1. candidates: own grid plus V1 planGen's pots on the same ball
  let cands = genPots(ctx, balls, false);
  if (B.planGen) {
    const pg = core.runSync(core.planGen({ balls }, { P, game: '9ball' })); ctx.sims += 0;   // planGen's own simulations are not counted
    for (const c of pg.cands || []) if (c.kind === 'pot' && c.target === lowest(balls).id) {
      const r = sim(ctx, balls, c.shot); if (!legalMake(r, c.target)) continue;
      const tb = lowest(balls), pk = P.pockets[c.pocket], g = core.potGeom(balls.find(b => b.id === 0), tb, pk, P.R);
      cands.push({ kind: 'pot', target: c.target, pocket: c.pocket, shot: c.shot, cut: c.cut, cueDist: g.cl, objDist: g.vl, res: r, from: 'planGen' });
    }
  }
  rankNominal(ctx, balls, cands);
  // 2. stage-one screen (few noisy repeats), then lookahead on the best few
  const screened = cands.slice(0, Math.max(B.screen, B.rootK + 2));
  for (const pk of new Set(cands.map(c => c.pocket))) {   // every pocket's easiest-looking shot gets screened as well
    const c = cands.filter(x => x.pocket === pk).sort((a, b) => b.ease - a.ease)[0];
    if (!screened.includes(c)) screened.push(c);
  }
  for (const c of screened) c.ev = evalNoisy(ctx, balls, c, B.screenN, 1, B.landings - 1);
  screened.sort((a, b) => b.ev.pMake * b.quickPos - a.ev.pMake * a.quickPos);
  const look = screened.filter(c => c.ev.pMake > 0).slice(0, B.rootK);
  for (const pk of new Set(screened.map(c => c.pocket))) {   // keep every pocket's surest shot in the lookahead too
    const c = screened.filter(x => x.pocket === pk && x.ev.pMake > 0).sort((a, b) => b.ev.pMake - a.ev.pMake)[0];
    if (c && !look.includes(c)) look.push(c);
  }
  // future averaged over landing spots: the nominal result plus noisy made repeats
  const futureOf = c => {
    const lays = [{ left: after(balls, c.res), end: c.res.pocketed.some(p => p.id === 9) }].concat(c.ev.lays);
    const v = lays.map(l => l.end ? 1 : nodeValue(ctx, l.left, depth - 1, width));
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  for (const c of look) { c.future = futureOf(c); c.value1 = c.ev.pMake * c.future; }
  look.sort((a, b) => b.value1 - a.value1);
  // stage two: re-check the leaders' make share with many more repeats before choosing
  const fin = look.slice(0, B.finalK);
  for (const c of fin) { c.ev2 = evalNoisy(ctx, balls, c, B.finalN, 2); c.value = c.ev2.pMake * c.future; }
  fin.sort((a, b) => b.value - a.value);
  for (const c of fin) { const rr = sim(ctx, balls, c.shot, true); c.path = rr.paths[0]; c.cueEnd = rr.final.find(b => b.id === 0) || null; }
  const offense = fin[0] || null;
  // 4. safeties, reported on their own
  let safety = null;
  if (B.safeties) {
    const ss = genSafeties(ctx, balls).slice(0, B.safeties);
    for (const c of ss) c.ev = evalSafety(ctx, balls, c, B.safetyN, 3);
    ss.sort((a, b) => b.ev.pLegal * b.ev.quality - a.ev.pLegal * a.ev.quality);
    if (ss[0]) { safety = ss[0]; safety.ev2 = evalSafety(ctx, balls, safety, B.safetyFinalN, 4); }
  }
  // 5. the pick (heuristic rule, stated)
  let pick = offense ? 'offense' : safety ? 'safety' : 'none', why;
  const om = offense ? offense.ev2.pMake : 0;
  if (offense && om < RULE.offenseMinMake && safety && safety.ev2.quality >= RULE.safetyMinQuality && safety.ev2.pLegal >= RULE.safetyMinLegal) pick = 'safety';
  if (pick === 'offense') why = `best offense: model make ${Math.round(om * 100)}%, next shot playable after ${Math.round(offense.ev.playable * 100)}% of makes, ${depth} shot(s) searched` + (safety ? `; safety not needed (rule: safety only when make < ${RULE.offenseMinMake * 100}%)` : '');
  else if (pick === 'safety') why = `offense make only ${Math.round(om * 100)}% in the model and a safety leaves the opponent little (quality ${Math.round(safety.ev2.quality * 100)}%, legal ${Math.round(safety.ev2.pLegal * 100)}%)`;
  else why = 'no legal pot or safety found';
  const alt = c => ({ target: c.target, pocket: c.pocket, from: c.from || 'search', ...describe(c, P), screenMake: c.ev && c.ev.pMake, make: c.ev2 ? c.ev2.pMake : null,
                      landingPlayable: c.ev && c.ev.playable, future: c.future, value: c.value != null ? c.value : c.value1 });
  return ST.proposal({ model: 'search v2 (heuristic; V1.8.1 physics, not validated on real shots)', pick, why,
    shot: pick === 'offense' ? offense.shot : pick === 'safety' ? safety.shot : null,
    offense: offense && { ...alt(offense), cueEnd: offense.cueEnd, shot: offense.shot },
    safety: safety && { target: safety.target, shot: safety.shot, ...describe(safety, P), pLegal: safety.ev2.pLegal, quality: safety.ev2.quality },
    alternatives: look.map(alt), rule: RULE, sims: ctx.sims, ms: Date.now() - t0, depth });
}

// The current planner (runout.js, greedy one-ahead) behind the same interface, for side-by-side tests.
function recommendBaseline(s) {
  const t0 = Date.now(), bp = RO.backwardPlan(s); if (bp.error) return { error: bp.error };
  if (!bp.plan.length) return { pick: 'none' };
  const p = RO.chooseShot(s, bp);
  return p ? { pick: 'offense', shot: p.shot, offense: { target: p.target, pocket: p.pocket, make: p.makeChance }, ms: Date.now() - t0 } : { pick: 'none', ms: Date.now() - t0 };
}

const api = { BUDGETS, NOISE, RULE, rng, gauss, noisy, recommend, recommendBaseline, posGrade, legalMake };
if (typeof module !== 'undefined') module.exports = api; else root.chalkSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
