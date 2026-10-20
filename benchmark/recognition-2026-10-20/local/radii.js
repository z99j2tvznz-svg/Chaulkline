// Ball radius in 1280x720 pixels for every detection spot of a detection folder, from the app's own table camera model
// (same setup and formula as the package's code/tools/experiments/reader-input.js: r = max(3, cam.ballRad) * 1280/800).
// Read only. Run in a clean temp copy is not needed: it only loads index.html from the package.
//   node radii.js <detections folder> <out.json>
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const PKG = path.join(__dirname, '..', '..', '..', 'collab', 'recognition-package-2026-10-20', 'code');
const { serve } = require(path.join(PKG, 'tests', 'lib', 'serve.js'));
const [DIR, OUT] = process.argv.slice(2);

(async () => {
  const srv = await serve(PKG, null), browser = await chromium.launch(), page = await browser.newPage();
  await page.goto(srv.url + '/index.html?norecog=0');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  const out = {};
  for (const f of fs.readdirSync(DIR).filter(f => /^(clip|shot)\d+\.json$/.test(f)).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const xy = d.frames.map(fr => fr.balls.map(b => [b.x, b.y]));
    out[f.replace('.json', '')] = await page.evaluate(({ QN, xy }) => {
      const C = __chalk, S = C.S;
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
      S.ft = 7; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1;
      setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
      const k = 1280 / 800, R = S.P.R;
      return xy.map(fr => fr.map(([x, y]) => +(Math.max(3, S.cam.ballRad(x, y, R, R)) * k).toFixed(3)));
    }, { QN: d.quadN, xy });
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  await browser.close(); srv.close();
})();
