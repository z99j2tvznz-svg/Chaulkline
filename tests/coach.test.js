// The coaching test's runout planner (src/v3/coach.js, V3.10): three balls ahead on a real layout (Nov 2, 20:54, rack 2:
// the 1, then the 2, then the 3), a ball not named still in the way, short runouts, and the planner in the page's worker.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
const { makeP } = require('../src/core.js'), COACH = require('../src/v3/coach.js'), P = makeP(7);
const NOV2 = [{ n: 1, x: 55.9, y: 31.6 }, { n: 7, x: 61.3, y: 25.5 }, { n: 2, x: 41.6, y: 9.1 }, { n: 6, x: 38.6, y: 12.3 }, { n: 5, x: 27.0, y: 10.3 }, { n: 9, x: 7.9, y: 6.5 }, { n: 8, x: 67.3, y: 12.5 }, { n: 4, x: 19.1, y: 19.6 }, { n: 3, x: 71.5, y: 11.2 }, { n: 0, x: 43.0, y: 28.9 }];
const count = (r, v) => r.cells.filter(c => c === v).length;
test('three balls ahead on Nov 2 rack 2: the 1 top-right, the 2 bottom side, the 3 bottom-right; the 6 in the way, a wrong side', () => {
  const r = COACH.plan(NOV2, P);
  assert.deepStrictEqual([r.A.pocket, r.B.pocket, r.C.pocket], [5, 1, 2]);
  assert.ok(count(r, 1) > 20 && count(r, 3) > 50 && count(r, 4) > 50, 'green, red and grey: ' + [count(r, 1), count(r, 3), count(r, 4)]);
  assert.ok(r.path && r.spot && r.route, 'the way into the zone and on to the 3');
  assert.strictEqual(COACH.gradeAt(r, r.spot[0], r.spot[1]), 'green');
  assert.strictEqual(COACH.gradeAt(r, 30, 20), 'blocked'); // behind the 6
  console.log('plan ms', r.ms);
});
test('a ball not named for sure is still in the way; a short runout; the 9 alone', () => {
  const r0 = COACH.plan([{ n: 0, x: 20, y: 20 }, { n: 3, x: 40, y: 20 }, { n: 9, x: 60, y: 30 }], P), r1 = COACH.plan([{ n: 0, x: 20, y: 20 }, { n: 3, x: 40, y: 20 }, { n: 9, x: 60, y: 30 }, { n: 107, x: 52, y: 26 }], P);
  assert.deepStrictEqual(r1.order, [3, 9]); assert.ok(count(r1, 4) > count(r0, 4) + 20, 'the unnamed ball blocks: ' + count(r0, 4) + ' -> ' + count(r1, 4));
  assert.ok(r0.A.pocket != null && r0.B.pocket != null && r0.C === null);
  const r2 = COACH.plan([{ n: 0, x: 20, y: 20 }, { n: 9, x: 70, y: 34 }], P); assert.strictEqual(r2.B, null); assert.strictEqual(r2.A.pocket, 5);
  assert.strictEqual(COACH.plan([{ n: 0, x: 20, y: 20 }], P), null);
});
test('the planner in the page, in a background worker from its own source, as the app runs it', { timeout: 120000 }, async () => {
  const { chromium } = require('playwright'), { serve } = require('./lib/serve.js');
  const srv = await serve(path.join(__dirname, '..')), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    const r = await page.evaluate(async balls => {
      const src = 'const COACH=(' + coachFactory.toString() + ')();onmessage=e=>postMessage(COACH.plan(e.data.balls,e.data.P));';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))), P = makeP(7);
      return await new Promise(res => { w.onmessage = e => res(e.data); w.postMessage({ balls, P: { R: P.R, L: P.L, W: P.W, pockets: P.pockets } }); });
    }, NOV2);
    assert.deepStrictEqual([r.A.pocket, r.B.pocket, r.C.pocket], [5, 1, 2]);
    assert.ok(await page.isVisible('#coachBtn'), 'the Coaching test on the home screen');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
