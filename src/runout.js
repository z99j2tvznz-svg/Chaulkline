// Experimental 9-ball runout planner on a hand-confirmed table state. Suggestion only; not part of the app build yet.
// Reuses core.js (V1.8.1): physics (simulate), shot search (planGen), shot grading (shotGrade, zoneGrade).
// New here: picking every ball's pocket working BACKWARD from the last ball, and choosing among planGen's shots the one
// whose predicted cue-ball stop lands in the next ball's position zone; then replanning from the predicted layout.
// Heuristic limits: other balls are assumed to stay put; one pocket per ball; no safeties, banks or kicks in the plan;
// physics is V1.8.1's and has not been checked against real shots.
'use strict';
(function (root) {
const core = typeof module !== 'undefined' ? require('./core.js') : root;
const ST = typeof module !== 'undefined' ? require('./state.js') : root.chalkState;
const ZQ = [0, 0.3, 0.65, 1];   // value of red / amber / green spots, as core.js values them

// Same test as core.js pathClear (not exported there): no other ball centre within `clear` of the segment.
function laneClear(ax, ay, bx, by, balls, skip, clear) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  return balls.every(b => { if (b.id === skip) return true; const t = l2 ? Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / l2)) : 0; return Math.hypot(b.x - ax - t * dx, b.y - ay - t * dy) >= clear; });
}
// Every pocket the ball can go into from where it is (clear lane, entry angle the pocket accepts). Same rule as core nextInfo.
function pocketOptions(tb, rest, P) {
  const R = P.R, D = P.L / 8, out = [];
  P.pockets.forEach((pk, pi) => {
    const vx = pk.x - tb.x, vy = pk.y - tb.y, vl = Math.hypot(vx, vy); if (vl < 0.1) return;
    if (!laneClear(tb.x, tb.y, pk.x, pk.y, rest, tb.id, 2 * R - 0.15)) return;
    const nx = pk.corner ? (pk.x < P.L / 2 ? -1 : 1) / Math.SQRT2 : 0, ny = pk.corner ? (pk.y < P.W / 2 ? -1 : 1) / Math.SQRT2 : (pk.y < P.W / 2 ? -1 : 1);
    const entry = Math.acos(Math.max(-1, Math.min(1, (vx * nx + vy * ny) / vl))) * 180 / Math.PI;
    if (entry > (pk.corner ? 60 : 55)) return;
    out.push({ pk, pi, ease: (1 - entry / 90) / (1 + vl / (3 * D)) * (pk.corner ? 1 : 0.85) });
  });
  return out;
}

// Grade every spot of the table for shooting `info` (one ball, one pocket), with natural shape to `after`.
function zoneGrid(info, after, rest, P, step) {
  const R = P.R, nx = Math.floor(P.L / step), ny = Math.floor(P.W / step), q = new Int8Array(nx * ny), z = { n: info, after, rest, P };
  let area = 0, cells = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * step, y = (j + 0.5) * step;
    if (x < R || x > P.L - R || y < R || y > P.W - R || rest.some(b => Math.hypot(b.x - x, b.y - y) < 2 * R)) { q[j * nx + i] = -2; continue; }
    cells++;
    const g = core.zoneGrade(x, y, z); q[j * nx + i] = g.q ? g.q : g.hooked ? -1 : 0; area += ZQ[g.q] || 0;
  }
  return { step, nx, ny, q, area: area / Math.max(1, cells) };   // q: 3 green, 2 amber, 1 red, 0 none, -1 hooked, -2 blocked
}
const gradeAt = (zone, x, y) => { const i = Math.floor(x / zone.step), j = Math.floor(y / zone.step); return i < 0 || j < 0 || i >= zone.nx || j >= zone.ny ? 0 : Math.max(0, zone.q[j * zone.nx + i]); };

// Backward pass: the last ball's pocket first, then each earlier ball's pocket chosen so that its zone also leads to the
// pocket already chosen for the ball after it. Ball order is 9-ball's (lowest first); other games need another order rule.
function backwardPlan(s, { step = 2.5 } = {}) {
  if (s.game.rules !== '9ball') throw new Error('only 9-ball has a ball order here');
  const P = ST.physicsOf(s), lay = ST.plannerLayout(s, 0.9);
  if (!lay.ok) return { error: 'not every ball is confirmed: ' + lay.doubtful.join(', ') };
  const objs = lay.balls.filter(b => b.id >= 1).sort((a, b) => a.id - b.id), plan = new Array(objs.length);
  for (let k = objs.length - 1; k >= 0; k--) {
    const tb = objs[k], rest = objs.slice(k), after = plan[k + 1] ? plan[k + 1].info : null;
    const opts = pocketOptions(tb, rest, P).map(o => {
      const info = { tb, tid: tb.id, pks: [o.pk] }, zone = zoneGrid(info, after, rest, P, step);
      return { ...o, info, zone, score: o.ease * (0.2 + zone.area) };
    }).sort((a, b) => b.score - a.score);
    plan[k] = opts.length ? { id: tb.id, pocket: opts[0].pi, info: opts[0].info, zone: opts[0].zone, others: opts.slice(1).map(o => ({ pocket: o.pi, score: o.score })), score: opts[0].score }
                          : { id: tb.id, pocket: -1, info: null, zone: null, others: [], score: 0, blocked: true };
  }
  return { P, plan };
}

// This shot: the best mix of making the ball AND leaving the cue ball in the next ball's zone. The chance is the model's
// robustness to small aim/speed errors, not a measured make rate for this player.
function chooseShot(s, bp, cfg = {}) {
  const P = bp.P, lay = ST.plannerLayout(s, 0), cur = bp.plan[0], next = bp.plan[1];
  const res = core.runSync(core.planGen(lay, { P, game: '9ball', skill: cfg.skill || 0.35, speedSd: cfg.speedSd }));
  const pots = (res.cands || []).filter(c => c.kind === 'pot' && c.target === cur.id);
  if (!pots.length) return null;
  // Position search (new): around each of planGen's pots, try softer/firmer and more follow/draw, keep shots that still
  // make the ball, and grade where the cue ball stops in the next ball's zone. Chance = share of 9 small aim/speed errors that still make it.
  const balls = lay.balls, D2R = Math.PI / 180, aim = (cfg.skill || 0.35) * D2R;
  const makes = sh => { const r = core.simulate(balls, sh, P); return r.firstHit === cur.id && r.pocketed.some(p => p.id === cur.id) && !r.pocketed.some(p => p.id === 0) ? r : null; };
  const chance = sh => { let ok = 0; for (const [da, f] of [[0, 1], [-1, 1], [1, 1], [-0.5, 0.92], [0.5, 1.08], [0, 0.9], [0, 1.1], [-1, 1.05], [1, 0.95]]) if (makes({ ...sh, angle: sh.angle + da * aim, speed: sh.speed * f })) ok++; return ok / 9; };
  const tries = [];
  for (const c of pots.slice(0, 6)) for (const f of [0.7, 0.85, 1, 1.15, 1.3]) for (const b of [-0.45, -0.25, 0, 0.25, 0.45]) {
    if (c.level * f > 10) continue;   // stay on the 1-10 strength scale
    const sh = { ...c.shot, speed: c.shot.speed * f, b }, r = makes(sh); if (!r) continue;
    const e = r.final.find(q => q.id === 0), g = next && next.zone ? (e ? gradeAt(next.zone, e.x, e.y) : 0) : 3;
    tries.push({ ...c, shot: sh, level: c.level * f, cueEnd: e, zoneQ: g, pre: ZQ[g] });
  }
  tries.sort((a, b) => b.pre - a.pre);
  const best = tries.filter(t => t.pre >= tries[0].pre - 0.36).slice(0, 12);   // only the best-placed ones get the slower chance check
  for (const c of best) { c.p = chance(c.shot); c.value = c.p * (0.25 + ZQ[c.zoneQ]) + (c.pocket === cur.pocket ? 0.05 : 0); }
  const pool = best.length ? best : pots.map(c => ({ ...c, zoneQ: 0, value: c.p * 0.25 }));
  pool.sort((a, b) => b.value - a.value);
  const c = pool[0];
  return ST.proposal({ target: c.target, pocket: c.pocket, plannedPocket: cur.pocket, shot: c.shot, cut: c.cut, level: c.level, ghost: c.ghost,
    makeChance: c.p, nextZone: c.zoneQ, alternatives: pool.length - 1, model: 'core.planGen + backward pocket plan (heuristic)' });
}

// Plan and play the rack forward in physics, replanning from each predicted layout. Stops at a miss, foul or no shot.
function runout(s, opts = {}) {
  const steps = []; let cur = s;
  for (let n = 0; n < 10; n++) {
    const bp = backwardPlan(cur, opts); if (bp.error) return { steps, stop: bp.error };
    if (!bp.plan.length) return { steps, stop: 'rack done' };
    const prop = chooseShot(cur, bp, opts);
    if (!prop) { steps.push({ state: cur, plan: bp.plan }); return { steps, stop: 'no makeable shot on the ' + bp.plan[0].id + ' (a safety is needed)' }; }
    const pred = ST.predict(cur, prop.shot, bp.P);
    steps.push({ state: cur, plan: bp.plan, proposal: prop, prediction: pred });
    const made = pred.pocketed.some(p => p.id === prop.target), scratch = pred.pocketed.some(p => p.id === 0);
    if (!made || scratch) return { steps, stop: scratch ? 'predicted scratch' : 'predicted miss' };
    if (prop.target === 9 || pred.pocketed.some(p => p.id === 9)) return { steps, stop: 'rack done' };
    cur = ST.hypothetical(cur, pred);
  }
  return { steps, stop: 'step limit' };
}

const api = { pocketOptions, zoneGrid, gradeAt, backwardPlan, chooseShot, runout };
if (typeof module !== 'undefined') module.exports = api; else root.chalkRunout = api;
})(typeof window !== 'undefined' ? window : globalThis);
