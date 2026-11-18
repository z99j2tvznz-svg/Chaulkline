// The table set by hand from the cushion points (V3.25.1, owner Nov 18): two points at each corner pocket, in any order;
// the corners where the cushions' lines cross, at the noses' height, then brought down to the cloth
const test = require('node:test'), assert = require('node:assert');
const core = require('../src/core.js'); Object.assign(global, core);
const V = require('../src/vision.js'), { L, Wd } = V.tableDims(7), NOSE = 1.4;
// two of the owner's Nov 17 22:43 table-check views: from behind the near rail, sideways, and from the right end, upright
const VIEWS = [{ quad: [[482.3, 460.3], [1465, 463.4], [1727.7, 746.9], [241.8, 742.6]], rot: 0, wh: [1920, 1080] }, { quad: [[61.3, 923], [401.8, 845.6], [1017.9, 1071.1], [588.5, 1293.3]], rot: 1, wh: [1080, 1920] }];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const [vi, v] of VIEWS.entries()) test('view ' + (vi + 1) + ': the eight points, shuffled and a third of a pixel off, give the corners to a pixel, and on the cloth', () => {
  const tc = V.tableCornersFor(v.rot, L, Wd), cam = makeCam(tc, v.quad, v.wh[0], v.wh[1], 0.72 * Math.max(...v.wh), [v.wh[0] / 2, v.wh[1] / 2]);
  // each corner pocket's points: 3.4 in from the corner along each cushion (a 4.8 in mouth), at the noses' height
  const pts = [];
  for (const [x, y] of [[0, 0], [L, 0], [L, Wd], [0, Wd]]) { const sx = x ? -1 : 1, sy = y ? -1 : 1; pts.push(cam.proj(x + 3.4 * sx, y, NOSE), cam.proj(x, y + 3.4 * sy, NOSE)); }
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  const noisy = pts.map(p => [p[0] + (rnd() - 0.5) * 0.66, p[1] + (rnd() - 0.5) * 0.66]);
  const q = V.quadFromRailPoints(noisy); assert.ok(q, 'four corners');
  const want = V.orderQuad(tc.map(([x, y]) => cam.proj(x, y, NOSE)));
  q.forEach((p, i) => assert.ok(Math.hypot(p[0] - want[i][0], p[1] - want[i][1]) < 1.5, 'corner ' + i + ' at the noses: ' + p.map(Math.round) + ' against ' + want[i].map(Math.round)));
  // on the cloth: the corners the camera puts there, against the nose corners taken for the cloth (the old way, an error)
  const cloth = V.clothQuadFromNose(q, v.rot, 7, v.wh[0], v.wh[1], 0.72, NOSE), truth = tc.map(([x, y]) => cam.proj(x, y, 0));
  let worst = 0, old = 0; cloth.forEach((p, i) => { worst = Math.max(worst, Math.hypot(p[0] - truth[i][0], p[1] - truth[i][1])); old = Math.max(old, Math.hypot(q[i][0] - truth[i][0], q[i][1] - truth[i][1])); });
  assert.ok(worst < 2 && old > 3 * worst, 'on the cloth within ' + worst.toFixed(1) + ' px (the noses taken for the cloth: ' + old.toFixed(1) + ' px off)');
});
test('points not in four pairs are refused', () => {
  assert.strictEqual(V.quadFromRailPoints([[0, 0], [10, 0]]), null);
  const spread = [[100, 100], [300, 100], [500, 100], [700, 100], [700, 400], [500, 400], [300, 400], [100, 400]]; // eight evenly spaced
  assert.strictEqual(V.quadFromRailPoints(spread), null);
});
