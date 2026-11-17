// The trail through what the camera did not see (src/v3/trail.js, V3.23, owner Nov 17): off a cushion, off the ball hit
// first, and a straight gap left straight
const test = require('node:test'), assert = require('node:assert');
const TRAIL = require('../src/v3/trail.js'), { makeP } = require('../src/core.js'), P = makeP(7);
const unit = v => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; }, along = (p, u, d) => [p[0] + u[0] * d, p[1] + u[1] * d];
const pt = (t, p) => ({ t, x: p[0], y: p[1] });

test('a ball found coming back off a cushion: its trail goes to the cushion and back, not straight', () => {
  const a = [20, 20], h = [P.L - P.R, 30], back = unit([-(h[0] - a[0]), h[1] - a[1]]), b = along(h, back, 10), c = along(h, back, 35);
  const f = TRAIL.fill([pt(0, a), pt(0.3, b), pt(0.6, c)], P);
  const w = f.filter(q => q.fill); assert.strictEqual(w.length, 1, JSON.stringify(f));
  assert.ok(Math.abs(w[0].x - h[0]) < 0.5 && Math.abs(w[0].y - h[1]) < 1.5, JSON.stringify(w[0]));
  assert.ok(w[0].t > 0 && w[0].t < 0.3);
});

test('the cue ball found past the ball it hit: its trail goes through the ghost ball, then off along the tangent line', () => {
  const a = [15, 12], ob = [45, 22], pk = P.pockets[5], u = unit([pk.x - ob[0], pk.y - ob[1]]), hit = TRAIL.hitOf(P, ob, null, pk);
  assert.ok(Math.abs(Math.hypot(hit[0] - ob[0], hit[1] - ob[1]) - 2 * P.R) < 1e-9);
  const tan = [u[1], -u[0]], b = along(hit, tan, 18), c = along(hit, tan, 26);
  const f = TRAIL.fill([pt(0, a), pt(0.33, b), pt(0.66, c)], P, { hit });
  const w = f.filter(q => q.fill); assert.ok(w.length >= 1 && Math.hypot(w[0].x - hit[0], w[0].y - hit[1]) < 0.01, JSON.stringify(f));
  // the object ball's own first move gives the way it went, when it was seen
  const h2 = TRAIL.hitOf(P, ob, [pt(0, ob), pt(0.3, along(ob, u, 9))]); assert.ok(Math.hypot(h2[0] - hit[0], h2[1] - hit[1]) < 1e-6);
});

test('a straight run with a gap stays straight; small steps are left alone', () => {
  const u = unit([3, 1]), a = [10, 10], f = TRAIL.fill([pt(0, a), pt(0.33, along(a, u, 30)), pt(0.66, along(a, u, 40)), pt(1, along(a, u, 44))], P);
  assert.strictEqual(f.filter(q => q.fill).length, 0); assert.strictEqual(f.length, 4);
  const g = TRAIL.fill([pt(0, [30, 20]), pt(0.3, [33, 21]), pt(0.6, [35, 21.5])], P); assert.strictEqual(g.length, 3);
});

test('two cushions: found in the corner area coming out, the trail goes round both', () => {
  // from (30, 12) into the far rail, then the right end rail, then back out toward the middle
  const a = [30, 12], h1 = [62, P.W - P.R], d1 = unit([h1[0] - a[0], h1[1] - a[1]]), d2 = [d1[0], -d1[1]];
  const tR = (P.L - P.R - h1[0]) / d2[0], h2 = along(h1, d2, tR), d3 = [-d2[0], d2[1]], b = along(h2, d3, 12), c = along(h2, d3, 30);
  assert.ok(h2[1] > P.R + 3 && h2[1] < P.W - P.R - 3, 'the second cushion met on the end rail, away from the pockets: ' + h2);
  const f = TRAIL.fill([pt(0, a), pt(0.35, b), pt(0.7, c)], P), w = f.filter(q => q.fill);
  assert.strictEqual(w.length, 2, JSON.stringify(f));
  assert.ok(Math.hypot(w[0].x - h1[0], w[0].y - h1[1]) < 1.5 && Math.hypot(w[1].x - h2[0], w[1].y - h2[1]) < 1.5, JSON.stringify(w));
});
