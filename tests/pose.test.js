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
      const base = location.href.replace(/[^/]*$/, ''); window.ort.env.wasm.wasmPaths = base + 'vendor/ort/'; await DET.loadPose(base); const out = {};
      for (const f of ['down-1313-hands009', 'down-1304-shot017-farside', 'up-1313-hands001', 'up-1309-hands002']) {
        const img = new Image(); img.src = 'tests/fixtures/v3/pose/' + f + '.jpg'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
        const o = await DET.pose(c, c.width, c.height), ps = POSE.decode(o.data, o.N, 0.4); out[f] = { n: ps.length, p: POSE.down(ps.map(p => ({ conf: p.conf, box: [...o.back(p.box[0], p.box[1]), ...o.back(p.box[2], p.box[3])], kp: p.kp.map(q => [...o.back(q[0], q[1]), q[2]]) }))) };
      }
      return out;
    });
    console.log(JSON.stringify(r));
    for (const [f, v] of Object.entries(r)) { assert.ok(v.n >= 1, f + ': a person found'); if (f.startsWith('down')) assert.ok(v.p >= 0.6, f + ' down: ' + v.p); else assert.ok(v.p <= 0.3, f + ' up: ' + v.p); }
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
