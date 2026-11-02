// The session review's numbers (src/v3/review.js): balls in, the share of shots that made a ball, runs, racks, and the
// table drawing. The screens themselves run in the browser test (tests/v3.test.js).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { makeP } = require('../src/core.js');
const src = fs.readFileSync(path.join(__dirname, '../src/v3/review.js'), 'utf8');
const REVIEW = new Function('makeP', 'BALLCOL', src.slice(0, src.indexOf('// ---------- the review screens')) + '\nreturn REVIEW;')(makeP, ['#fff', '#ee0', '#22c', '#d33', '#639', '#e72', '#184', '#823', '#111', '#ee0']);
const S = (n, rack, made, o = {}) => Object.assign({ n, rack, cue: 0, made: made.map(num => ({ num, pocket: 0 })), scratch: false, break: false }, o);

test('numbers: balls in, shots that made a ball (breaks left out), misses, scratches', () => {
  const sh = [S(1, 1, [3], { break: true }), S(2, 1, [1]), S(3, 1, []), S(4, 1, [2, 0], { scratch: true }), S(5, 1, [null])];
  const st = REVIEW.stats(sh);
  assert.strictEqual(st.ballsIn, 4); assert.strictEqual(st.tries, 4); assert.strictEqual(st.potted, 3); assert.strictEqual(st.misses, 1); assert.strictEqual(st.scratches, 1);
});

test('a run: shots in a row that made a ball without a scratch, counted within a rack', () => {
  const sh = [S(1, 1, [1], { break: true }), S(2, 1, [2]), S(3, 1, [3]), S(4, 1, []), S(5, 2, [1]), S(6, 2, [2]), S(7, 2, [4, 0], { scratch: true })];
  assert.strictEqual(REVIEW.runs(sh), 3);
  const rk = REVIEW.racks(sh); assert.deepStrictEqual(rk.map(r => [r.rack, r.shots, r.ballsIn, r.bestRun]), [[1, 4, 3, 3], [2, 3, 3, 2]]);
});

test('the drawing: every ball that moved has its path, a pocketed ball\'s path ends in its pocket, resting balls are drawn', () => {
  const s = S(4, 1, [3]); s.made[0].pocket = 2;
  s.before = [[0, 20, 10], [3, 60, 8], [5, 40, 30]];
  s.paths = [{ num: 0, p: [[20, 10], [40, 9], [55, 8.5]] }, { num: 3, p: [[60, 8], [70, 4]] }];
  const svg = REVIEW.diagram(s, 7);
  assert.strictEqual((svg.match(/<polyline/g) || []).length, 2);
  assert.ok(svg.includes('78.00,39.00'), 'the 3 runs into the bottom-right pocket (y flipped: 39 - 0)');
  assert.ok(/>5<\/text>/.test(svg), 'the 5, resting, is drawn with its number');
});

test('a path keeps its shape with far fewer points', () => {
  const pts = []; for (let i = 0; i <= 100; i++) pts.push([10 + i * 0.1, 5]);
  const t = REVIEW.thin(pts); assert.ok(t.length <= 22 && t.length >= 20, t.length); assert.deepStrictEqual(t[t.length - 1], [20, 5]);
});

test('the review screens in the page: the last session from home, a shot from above with its picture and its clip playing', { timeout: 120000 }, async () => {
  const { chromium } = require('playwright'), { serve } = require('./lib/serve.js');
  const srv = await serve(path.join(__dirname, '..')), browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 440, height: 956 } })).newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    await page.evaluate(async () => {
      const v = window.__v3, sid = 1730000000000, jpg = async (c) => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 64, 32); return new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/jpeg'))).arrayBuffer()); };
      await v.STORE.begin(sid, { t0: sid });
      const files = [{ name: 'shot002-after.jpg', data: await jpg('#0a0') }, { name: 'clips/shot002/000.jpg', data: await jpg('#a00') }, { name: 'clips/shot002/001.jpg', data: await jpg('#00a') },
        { name: 'clips/shot002/index.json', data: new TextEncoder().encode(JSON.stringify({ list: [['000.jpg', 0], ['001.jpg', 66]] })) }];
      await v.STORE.putMany(sid, files);
      const mk = (n, made, o) => Object.assign({ n, rack: 1, cue: 0, first: made[0] || 1, made: made.map(num => ({ num, pocket: 2 })), scratch: false, break: false, before: [[0, 20, 10], [1, 60, 9], [5, 40, 30]], paths: [{ num: 0, p: [[20, 10], [50, 9]] }] }, o);
      v.A.lastSess = { t0: sid, sid, ft: 7, mins: 12, version: 'V3.2.0', shots: [mk(1, [], { break: true }), Object.assign(mk(2, [1]), { paths: [{ num: 0, p: [[20, 10], [55, 9]] }, { num: 1, p: [[60, 9], [70, 4]] }] }), mk(3, [], { rack: 2 })] };
      renderHome();
    });
    await page.click('#lastOpen'); await page.waitForSelector('#sum:not([hidden])');
    assert.match(await page.textContent('#sumStats'), /3\s*shots.*1\s*balls in.*50%/s);
    assert.match(await page.textContent('#sumRacks'), /Rack 1.*Rack 2/s);
    await page.click('#sumList .sbtn[data-i="1"]'); await page.waitForSelector('#shotView:not([hidden])');
    assert.strictEqual(await page.locator('#svTable svg polyline').count(), 2);
    await page.waitForSelector('#svSeg button');
    assert.deepStrictEqual(await page.$$eval('#svSeg button', b => b.map(x => x.textContent)), ['Clip', 'After']);
    const a = await page.getAttribute('#svMedia img', 'src'); await page.waitForFunction(s => document.querySelector('#svMedia img').src !== s, a, { timeout: 5000 });
    await page.click('#svNext'); await page.waitForFunction(() => document.querySelector('#svTitle').textContent.includes('Shot 3'));
    await page.waitForFunction(() => /No pictures kept/.test(document.querySelector('#svMedia').textContent), null, { timeout: 5000 });
    await page.click('#svClose'); assert.ok(await page.isHidden('#shotView'));
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
