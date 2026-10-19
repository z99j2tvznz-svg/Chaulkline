// Planner-free probe of a layout: for the ball to shoot, each reachable pocket's cut and distance, and where plain
// ghost-ball shots (strength x follow/draw, no side spin) leave the cue ball for the next ball. Physics + geometry only.
//   node tools/runout-eval/probe.js '<json [[id,x,y],...]>'
'use strict';
const core = require('../../src/core.js'), RO = require('../../src/runout.js');
const P = core.makeP(9), MPH = core.MPH, D2R = Math.PI / 180;
function probe(balls) {
  const B = balls.map(([id, x, y]) => ({ id, x, y })), cue = B.find(b => b.id === 0), objs = B.filter(b => b.id > 0).sort((a, b) => a.id - b.id);
  const tb = objs[0], rest = objs, out = [];
  for (const o of RO.pocketOptions(tb, rest, P)) {
    const g = core.potGeom(cue, tb, o.pk, P.R), cut = Math.acos(Math.max(-1, Math.min(1, g.cosCut))) / D2R;
    if (cut > 80) continue;
    const row = { pocket: o.pi, cut: +cut.toFixed(0), dist: +g.cl.toFixed(0), shots: [] };
    for (const L of [2, 3, 5, 7]) for (const b of [-0.4, 0, 0.4]) {
      let made = null;
      for (const off of [0, 0.3, -0.3, 0.6, -0.6, 1, -1]) { const r = core.simulate(B, { angle: g.ang + off * D2R, speed: L * 1.6 * MPH, a: 0, b }, P); if (r.pocketed.some(p => p.id === tb.id) && r.firstHit === tb.id) { made = r; break; } }
      if (!made) { row.shots.push(`L${L}b${b}:miss`); continue; }
      if (made.pocketed.some(p => p.id === 0)) { row.shots.push(`L${L}b${b}:scratch`); continue; }
      const c = made.final.find(q => q.id === 0), left = made.final.filter(q => q.id > 0);
      const n = core.nextInfo(left, '9ball', null, P); let q = 0, nc = null;
      if (n) for (const pk of RO.pocketOptions(n.tb, left, P)) { const sg = core.shotGrade(c.x, c.y, { tb: n.tb, tid: n.tid, pks: [pk.pk] }, left, P); if (sg.q > q) { q = sg.q; nc = Math.acos(Math.max(-1, Math.min(1, sg.g.cosCut))) / D2R; } }
      row.shots.push(`L${L}b${b}:(${c.x.toFixed(0)},${c.y.toFixed(0)})q${q}${nc != null ? 'c' + nc.toFixed(0) : ''}`);
    }
    out.push(row);
  }
  return out;
}
if (require.main === module) for (const r of probe(JSON.parse(process.argv[2]))) console.log(`pocket ${r.pocket} cut ${r.cut} dist ${r.dist}: ${r.shots.join(' ')}`);
module.exports = { probe };
