// Unit tests for the pure maths in src/core.js and src/vision.js (no browser needed).
// Run: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/core.js');
const vision = require('../src/vision.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// A synthetic pinhole camera standing beside a 7 ft table: project table points to pixels.
function pinhole({ f = 900, W = 800, H = 450, C = [39, -60, 55], look = [39, 25, 0] } = {}) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), norm = a => { const n = Math.hypot(...a); return a.map(v => v / n); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const fwd = norm(sub(look, C)), right = norm(cross(fwd, [0, 0, 1])), down = cross(fwd, right);
  return (x, y, z = 0) => {
    const d = sub([x, y, z], C), X = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
    const Y = d[0] * down[0] + d[1] * down[1] + d[2] * down[2], Z = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
    return [f * X / Z + W / 2, f * Y / Z + H / 2];
  };
}

test('homography maps the four source corners onto the four target corners', () => {
  const src = [[0, 0], [78, 0], [78, 39], [0, 39]], dst = [[100, 400], [700, 410], [600, 120], [180, 115]];
  const Hm = core.homography(src, dst);
  src.forEach((p, i) => { const q = core.applyH(Hm, p[0], p[1]); near(q[0], dst[i][0], 1e-6, 'x'); near(q[1], dst[i][1], 1e-6, 'y'); });
});

test('invert3 undoes a homography', () => {
  const Hm = core.homography([[0, 0], [78, 0], [78, 39], [0, 39]], [[100, 400], [700, 410], [600, 120], [180, 115]]);
  const Hi = core.invert3(Hm), q = core.applyH(Hm, 20, 30), back = core.applyH(Hi, q[0], q[1]);
  near(back[0], 20, 1e-6, 'x'); near(back[1], 30, 1e-6, 'y');
});

test('makeCam recovers a real camera from the table outline (points on the cloth and at ball height)', () => {
  const proj = pinhole(), corners = [[0, 0], [78, 0], [78, 39], [0, 39]];
  const cam = core.makeCam(corners, corners.map(p => proj(p[0], p[1])), 800, 450, 900, [400, 225]);
  assert.ok(cam.ok, 'camera solved');
  for (const [x, y, z] of [[10, 5, 0], [60, 30, 0], [39, 19.5, 1.125], [70, 36, 2.25]]) {
    const a = cam.proj(x, y, z), b = proj(x, y, z);
    near(a[0], b[0], 0.05, `x at ${x},${y},${z}`); near(a[1], b[1], 0.05, `y at ${x},${y},${z}`);
  }
  near(cam.C[2], 55, 0.1, 'camera height');
});

test('makeP table sizes and six pockets', () => {
  for (const [ft, L, W] of [[7, 78, 39], [8, 88, 44], [9, 100, 50]]) {
    const P = core.makeP(ft); assert.strictEqual(P.L, L); assert.strictEqual(P.W, W); assert.strictEqual(P.pockets.length, 6);
  }
});

test('hungarian finds the cheapest one-to-one assignment', () => {
  const a = [[4, 1, 3], [2, 0, 5], [3, 2, 2]];
  const ans = vision.hungarian(a), cost = ans.reduce((s, j, i) => s + a[i][j], 0);
  assert.strictEqual(new Set(ans).size, 3);
  assert.strictEqual(cost, 5); // 1 + 2 + 2
});

test('rgb2hsv on primary and grey colours', () => {
  assert.deepStrictEqual(vision.rgb2hsv(255, 0, 0), [0, 1, 1]);
  const [h, s, v] = vision.rgb2hsv(0, 0, 255); near(h, 240, 1e-9, 'blue hue'); assert.strictEqual(s, 1); assert.strictEqual(v, 1);
  const g = vision.rgb2hsv(128, 128, 128); assert.strictEqual(g[1], 0);
});
