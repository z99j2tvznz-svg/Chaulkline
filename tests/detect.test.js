// V3 ball finder and number reader in the browser (ONNX Runtime Web, CPU engine in headless Chromium), on the 14
// player-verified frames from the held-out sessions (tests/fixtures/v3). Checks that the browser port gives the same
// answers as the Python reference run (tools/v3/ref_eval.py): same balls found, same numbers read. Also checks the
// check page opens a photo, draws its rings and saves without an error.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..'), FIX = path.join(ROOT, 'tests/fixtures/v3');
const frames = fs.readdirSync(FIX).filter(f => f.endsWith('-end.json')).map(f => f.slice(0, -5)); // the 14 verified frames
const REF = JSON.parse(fs.readFileSync(path.join(FIX, 'reference-detections.json'), 'utf8'));
const jpgOf = name => fs.readdirSync(FIX).find(f => f.endsWith('.jpg') && f.replace(/\./g, '_').slice(0, -4) === name);

test('finder and reader in the browser match the Python reference on the verified frames', { timeout: 300000 }, async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/check/index.html'); await page.waitForFunction(() => window.ort && window.DET);
    await page.evaluate(async () => { await DET.load({ base: new URL('../', location.href).href, ep: 'wasm', finder: { file: 'models/detector-v1-960x544.onnx', w: 960, h: 544, fixed: true } }); });
    const tot = { balls: 0, found: 0, sureRight: 0, sureWrong: 0, refSpots: 0, sameSpots: 0, labelRight: 0, labelN: 0 };
    for (const name of frames) {
      const labels = JSON.parse(fs.readFileSync(path.join(FIX, name + '.json'), 'utf8')).balls.filter(b => b.num != null && !b.unknown);
      const out = await page.evaluate(async ({ url, labels }) => {
        const im = new Image(); im.src = url; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
        const img = c.getImageData(0, 0, cv.width, cv.height), spots = await DET.find(cv, cv.width, cv.height); await DET.read(img, spots);
        const atLabels = await DET.read(img, labels.map(b => ({ px: b.x, py: b.y, r: b.r })));
        return { spots: spots.map(s => ({ px: s.px, py: s.py, r: s.r, num: s.num, kind: s.kind })), atLabels: atLabels.map(s => ({ num: s.num, kind: s.kind })) };
      }, { url: srv.url + '/tests/fixtures/v3/' + encodeURIComponent(jpgOf(name)), labels });
      const ref = REF[name]['960x544']; tot.refSpots += ref.length;
      for (const q of ref) if (out.spots.some(s => Math.hypot(s.px - q[0], s.py - q[1]) < 2)) tot.sameSpots++;
      const used = new Set();
      for (const b of labels) {
        tot.balls++;
        let j = -1, bd = 1e9; out.spots.forEach((s, i) => { const d = Math.hypot(s.px - b.x, s.py - b.y); if (!used.has(i) && d < bd) { bd = d; j = i; } });
        if (j >= 0 && bd <= Math.max(4, b.r)) { used.add(j); tot.found++; const s = out.spots[j]; if (s.kind === 'sure') s.num === b.num ? tot.sureRight++ : tot.sureWrong++; }
      }
      labels.forEach((b, i) => { tot.labelN++; if (out.atLabels[i].kind === 'sure' && out.atLabels[i].num === b.num) tot.labelRight++; });
    }
    console.log('browser on the verified frames:', tot);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(tot.balls, 110);
    assert.ok(tot.found >= 109, 'balls found: ' + tot.found);                       // Python reference: 110
    // the browser shrinks the picture with its own filter, not Pillow's, so a few weak spots near the threshold differ (126 of 129 shared)
    assert.ok(tot.sameSpots >= tot.refSpots - 5, 'spots shared with the reference: ' + tot.sameSpots + ' of ' + tot.refSpots);
    assert.ok(tot.sureRight >= 97 && tot.sureWrong <= 4, 'reader on found balls: ' + tot.sureRight + ' right, ' + tot.sureWrong + ' wrong'); // reference 99 / 3
    assert.ok(tot.labelRight >= 97, 'reader at the labelled spots: ' + tot.labelRight);  // reference 99 of 110
  } finally { await browser.close(); srv.close(); }
});

test('check page: a photo gets rings, an upright photo is turned for the finder, Save works', { timeout: 300000 }, async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/check/index.html');
    const name = frames.find(n => n.startsWith('rec-20261018')), jpg = path.join(FIX, jpgOf(name));
    await page.setInputFiles('#photo', jpg);
    await page.waitForFunction(() => window.CHECK.last && window.CHECK.balls.length > 0, null, { timeout: 120000 });
    const flat = await page.evaluate(() => window.CHECK.balls.filter(b => b.kind === 'sure').map(b => [Math.round(b.px), Math.round(b.py), b.num]));
    assert.ok(flat.length >= 5, 'sure balls on the photo: ' + flat.length);
    assert.ok(await page.evaluate(() => document.querySelector('#ov').width > 0));
    // the same picture turned upright must give the same balls (turned back), via the finder's own quarter turn
    const upright = await page.evaluate(async () => {
      const S = window.CHECK, W = S.frame.width, H = S.frame.height, cv = document.createElement('canvas'); cv.width = H; cv.height = W;
      const c = cv.getContext('2d'); c.translate(H, 0); c.rotate(Math.PI / 2); c.drawImage(S.frame, 0, 0); // (x, y) -> (H - y, x)
      const img = cv.getContext('2d').getImageData(0, 0, H, W), spots = await DET.find(cv, H, W); await DET.read(img, spots);
      return spots.filter(b => b.kind === 'sure').map(b => [Math.round(b.py), Math.round(H - b.px), b.num]);
    });
    let same = 0; for (const a of flat) if (upright.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < 3 && a[2] === b[2])) same++;
    assert.ok(same >= flat.length - 1, 'upright picture: ' + same + ' of ' + flat.length + ' balls the same');
    const dl = page.waitForEvent('download'); await page.click('#bSave'); const d = await dl;
    assert.match(d.suggestedFilename(), /^chalkline-check-.*\.(json|jpg)$/);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});

test('table strip on the owner\'s bunched photo: shared-weights graph, 8 of 10 balls, same when the phone is upright', { timeout: 300000 }, async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/check/index.html'); await page.waitForFunction(() => window.ort && window.DET);
    const r = await page.evaluate(async () => {
      const T = await (await fetch('../tests/fixtures/v3/owner-20261027-bunched.truth.json')).json(), [bx, by, bw, bh] = T.tableBox, sh = DET.pickShape(bw, bh);
      await DET.load({ base: new URL('../', location.href).href, ep: 'wasm', finder: sh });
      const im = new Image(); im.src = '../tests/fixtures/v3/owner-20261027-bunched.jpg'; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0);
      const spots = await DET.find(cv, cv.width, cv.height, { box: T.tableBox, kmax: 1.5 });
      const found = Object.entries(T.balls).filter(([n, [x, y]]) => spots.some(s => Math.hypot(s.px - x, s.py - y) < 7)).map(([n]) => n);
      const H = cv.height, up = document.createElement('canvas'); up.width = H; up.height = cv.width; const u = up.getContext('2d'); u.translate(H, 0); u.rotate(Math.PI / 2); u.drawImage(cv, 0, 0);
      const us = await DET.find(up, H, cv.width, { box: [H - (by + bh), bx, bh, bw], kmax: 1.5 });
      const ufound = Object.entries(T.balls).filter(([n, [x, y]]) => us.some(s => Math.hypot(s.py - x, (H - s.px) - y) < 7)).map(([n]) => n);
      return { shape: [sh.w, sh.h], found, ufound };
    });
    console.log('bunched photo:', r);
    assert.deepStrictEqual(r.shape, [1568, 352]);
    assert.ok(r.found.length >= 8, 'found ' + r.found); assert.deepStrictEqual(r.ufound.sort(), r.found.sort());
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
