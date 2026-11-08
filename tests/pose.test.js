// The player's pose (V3.8.11): YOLO11n-pose in the app's onnxruntime-web, decoded (src/v3/pose.js) and through the
// body-shape model, on frames from the owner's sessions of Nov 8 (the look just before a move): down on the shot from the
// near end, down on the shot from the far side facing the phone, and standing up at the table.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
test('the pose: down on the shot from two sides, standing up from two', { timeout: 180000 }, async () => {
  const { chromium } = require('playwright'), { serve } = require('./lib/serve.js');
  const srv = await serve(path.join(__dirname, '..')), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      // as on the phone: the finder first (it puts the runtime in its background worker), then the pose, each picture twice
      const base = location.href.replace(/[^/]*$/, ''); await DET.load({ base, ep: 'wasm', finder: DET.pickShape(1700, 430) }); await DET.loadPose(base); const out = {};
      for (const f of ['down-1313-hands009', 'down-1304-shot017-farside', 'up-1313-hands001', 'up-1309-hands002']) {
        const img = new Image(); img.src = 'tests/fixtures/v3/pose/' + f + '.jpg'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
        await DET.pose(c, c.width, c.height); const o = await DET.pose(c, c.width, c.height), ps = POSE.decode(o.data, o.N, 0.4); out[f] = { n: ps.length, p: POSE.down(ps.map(p => ({ conf: p.conf, box: [...o.back(p.box[0], p.box[1]), ...o.back(p.box[2], p.box[3])], kp: p.kp.map(q => [...o.back(q[0], q[1]), q[2]]) }))) };
      }
      return out;
    });
    console.log(JSON.stringify(r));
    for (const [f, v] of Object.entries(r)) { assert.ok(v.n >= 1, f + ': a person found'); if (f.startsWith('down')) assert.ok(v.p >= 0.6, f + ' down: ' + v.p); else assert.ok(v.p <= 0.3, f + ' up: ' + v.p); }
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});

// The stance call from the readings before a ball sets off (V3.8.13), on the readings of Nov 8 14:15 (0.8 s apart).
test('the stance: down at once, upright only when sure', () => {
  const POSE = require('../src/v3/pose.js'), r = (a, face = true, over = true) => a.map(([t, p]) => ({ t, p, face, over }));
  assert.strictEqual(POSE.stance(r([[9.2, 0.99]]), 10), 'down', 'hands 3: down on the shot');
  assert.strictEqual(POSE.stance(r([[9.2, 0.56], [9.75, 0.05]]), 10), null, 'shot 15: bent 0.8 s before a reach shot, not upright');
  assert.strictEqual(POSE.stance(r([[9.2, 0.02], [9.75, 0.02]], false), 10), null, 'shot 12: from behind, unsure');
  assert.strictEqual(POSE.stance(r([[9.2, 0.01], [9.75, 0.01]]), 10), 'up', 'shot 1: upright facing the phone, setting balls');
  assert.strictEqual(POSE.stance(r([[9.75, 0.01]]), 10), null, 'one reading is not enough');
  assert.strictEqual(POSE.stance(r([[9.2, 0.01], [9.75, 0.01]], true, false), 10), null, 'away from the table');
  assert.strictEqual(POSE.stance(r([[7, 0.99]]), 10), null, 'too old');
});
