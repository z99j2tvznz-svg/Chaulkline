// Planner-free search for challenge layouts (physics + V1 geometry only, so the expected answer does not come from
// either planner). Prints candidate layouts and the property that defines their expected answer.
//   node tools/runout-eval/find-layouts.js <kind: shape|route|endgame> <seed> <max tries>
'use strict';
const core = require('../../src/core.js'), RO = require('../../src/runout.js'), S = require('../../src/search.js');
const P = core.makeP(9), D2R = Math.PI / 180, MPH = core.MPH;
const [kind, seed0, tries] = [process.argv[2], +process.argv[3] || 1, +process.argv[4] || 3000];
const r = S.rng(seed0), U = (a, b) => a + (b - a) * r();
const B = L => L.map(([id, x, y]) => ({ id, x, y }));
// Plain ghost-ball shots (4 strengths x draw/center/follow) into one pocket: per shot whether it is made and the
// V1 grade (0-3) of the cue ball for the next ball. Model make share from 12 noisy repeats of the surest one.
function plain(balls, tid, pi) {
  const cue = balls.find(b => b.id === 0), tb = balls.find(b => b.id === tid), g = core.potGeom(cue, tb, P.pockets[pi], P.R);
  const cut = Math.acos(Math.max(-1, Math.min(1, g.cosCut))) / D2R; if (cut > 70) return null;
  const shots = [];
  for (const L of [2, 3.5, 5, 7]) for (const b of [-0.4, 0, 0.4]) {
    let res = null, sh = null;
    for (const d of [0, 0.4, -0.4, 0.8, -0.8]) { const s = { angle: g.ang + d * D2R, speed: L * 1.6 * MPH, a: 0, b }; const rr = core.simulate(balls, s, P); if (S.legalMake(rr, tid)) { res = rr; sh = s; break; } }
    if (!res) continue;
    const left = res.final.filter(q => !res.pocketed.some(p => p.id === q.id)), cue2 = left.find(q => q.id === 0);
    shots.push({ L, b, shot: sh, q: left.some(q => q.id > 0) ? S.posGrade(left, cue2.x, cue2.y, P).q : 3, left });
  }
  let make = 0;
  if (shots.length) { const s0 = shots.find(s => s.L === 3.5 && s.b === 0) || shots[0], rr = S.rng(7); for (let i = 0; i < 12; i++) if (S.legalMake(core.simulate(balls, S.noisy(s0.shot, rr), P), tid)) make++; }
  return { pi, cut: Math.round(cut), dist: Math.round(g.cl + g.vl), shots, make: make / 12, best: Math.max(0, ...shots.map(s => s.q)), n3: shots.filter(s => s.q === 3).length };
}
// Geometry only (no simulation): cut and total distance into each reachable pocket.
function geo(balls, tid) {
  const cue = balls.find(b => b.id === 0), tb = balls.find(b => b.id === tid);
  return RO.pocketOptions(tb, balls.filter(b => b.id > 0), P).map(o => { const g = core.potGeom(cue, tb, o.pk, P.R); return { pi: o.pi, cut: Math.acos(Math.max(-1, Math.min(1, g.cosCut))) / D2R, dist: g.cl + g.vl }; });
}
function pockets(balls, tid) { const tb = balls.find(b => b.id === tid); return RO.pocketOptions(tb, balls.filter(b => b.id > 0), P).map(o => plain(balls, tid, o.pi)).filter(x => x && x.shots.length >= 4); }
const ok = L => L.every((a, i) => L.every((b, j) => i >= j || Math.hypot(a[1] - b[1], a[2] - b[2]) > 5)) && L.every(a => a[1] > 2 && a[1] < 98 && a[2] > 2 && a[2] < 48);
const rnd = () => [+U(3, 97).toFixed(1), +U(3, 47).toFixed(1)];
const near = (p, d) => [+(p[0] + U(-d, d)).toFixed(1), +(p[1] + U(-d, d)).toFixed(1)];
let found = 0; const cnt = {};
for (let t = 0; t < tries && found < 3; t++) {
  let L;
  if (kind === 'shape') {   // easy pot with poor shape vs a somewhat harder pot with natural shape (cue, 1, 9)
    const pk = P.pockets[Math.floor(r() * 6)], one = near([Math.min(90, Math.max(10, pk.x)), Math.min(40, Math.max(10, pk.y))], 10);
    L = [[0, ...near(one, 25)], [1, ...one], [9, ...rnd()]]; if (!ok(L)) continue;
    const gg = geo(B(L), 1); if (!(gg.some(x => x.cut <= 15 && x.dist <= 50) && gg.some(x => x.cut > 20 && x.cut <= 55 && x.dist <= 80))) continue;
    cnt.geo = (cnt.geo || 0) + 1;
    const ps = pockets(B(L), 1), A = ps.find(p => p.make >= 0.75 && p.best <= 1), C = ps.find(p => p !== A && p.make >= 0.3 && p.make < (A ? A.make : 1) && p.n3 >= 2);
    if (A) cnt.A = (cnt.A || 0) + 1; if (ps.some(p => p.make >= 0.3 && p.n3 >= 2)) cnt.C = (cnt.C || 0) + 1;
    if (A && C) { found++; console.log(JSON.stringify({ kind, balls: L, easy: { pocket: A.pi, cut: A.cut, make: A.make, bestGrade: A.best }, shape: { pocket: C.pi, cut: C.cut, make: C.make, greenShots: C.n3 } })); }
  } else if (kind === 'route') {   // two similar pockets for the 1, only one leads on to good shape on the 2 (cue, 1, 2, 9)
    L = [[0, ...rnd()], [1, ...rnd()], [2, ...rnd()], [9, ...rnd()]]; if (!ok(L)) continue;
    if (geo(B(L), 1).filter(x => x.cut <= 45 && x.dist <= 70).length < 2) continue;
    const ps = pockets(B(L), 1).filter(p => p.make >= 0.4); if (ps.length < 2) continue;
    const good = ps.find(p => p.n3 >= 2), bad = ps.find(p => p !== good && p.best <= 1 && p.make >= (good ? good.make - 0.15 : 9));
    if (good && bad) { found++; console.log(JSON.stringify({ kind, balls: L, route: { pocket: good.pi, cut: good.cut, make: good.make, greenShots: good.n3 }, other: { pocket: bad.pi, cut: bad.cut, make: bad.make, bestGrade: bad.best } })); }
  } else if (kind === 'endgame') {   // 7-8-9: shots on the 7 split into ones whose result leaves the 8 easy but the 9 hard after it, and ones that set up both
    L = [[0, ...rnd()], [7, ...rnd()], [8, ...rnd()], [9, ...rnd()]]; if (!ok(L)) continue;
    const ps = pockets(B(L), 7).filter(p => p.make >= 0.6); if (!ps.length) continue;
    const tag = [];
    for (const p of ps) for (const s of p.shots) if (s.q === 3) {   // green on the 8: does any plain shot on the 8 then leave green on the 9?
      const p8 = pockets(s.left, 8); tag.push({ pocket: p.pi, L: s.L, b: s.b, nineAfter: Math.max(0, ...p8.map(x => x.best)), make8: Math.max(0, ...p8.map(x => x.make)) });
    }
    const trap = tag.find(x => x.make8 >= 0.7 && x.nineAfter <= 1), good = tag.find(x => x.make8 >= 0.6 && x.nineAfter === 3);
    if (trap && good) { found++; console.log(JSON.stringify({ kind, balls: L, trap, good })); }
  }
}

console.error(JSON.stringify(cnt));
