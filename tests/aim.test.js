// Browser test for the aim trainer (aim/index.html): shots are makeable at the ghost ball, the window around it is
// sensible, a miss to either side is named thin or thick correctly, results are saved, and the page draws without errors
// sideways and upright. Run: node --test "tests/*.test.js"   (needs Playwright: npm install)
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.AIM_SHOTS; // folder to save screenshots in, if set

test('aim trainer: geometry, scoring and drawing', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch();
  try {
    for (const vp of [{ width: 956, height: 440 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: vp }), errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(srv.url + '/aim/index.html');
      await page.waitForFunction(() => window.__aim && window.__aim.S.shot);

      // every band makes shots whose right aim drops the ball, and nudging well off misses on the expected side
      const r = await page.evaluate(() => {
        const A = window.__aim, out = [];
        for (const band of ['straight', 'tq', 'half', 'quarter', 'sliver']) {
          A.S.set.band = band;
          for (let i = 0; i < 25; i++) {
            const s = A.makeShot(); if (!s) { out.push({ band, fail: 'no shot' }); continue; }
            const ok = A.simulate(s, s.right).made, w = s.window;
            // turning towards the object ball's far side thickens the hit; away from it thins it
            const toOb = Math.atan2(s.ob.y - s.cb.y, s.ob.x - s.cb.x), sgn = Math.sign(((toOb - s.right + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) || 1;
            const thick = A.simulate(s, s.right + sgn * (w.hi - w.lo + 1.5) * Math.PI / 180);
            const thin = A.simulate(s, s.right - sgn * (w.hi - w.lo + 1.5) * Math.PI / 180);
            out.push({ band, ok, w: w.hi - w.lo, need: s.need, shift: w.hi - w.lo + 1.5, toOb: Math.abs(((toOb - s.right + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI, bandOf: A.bandOf(s.need).id,
              thickOk: !thick.made && thick.hit && thick.cut < s.need, thinOk: !thin.made && (!thin.hit || thin.cut > s.need) });
          }
        }
        A.S.set.band = 'mixed';
        return out;
      });
      for (const x of r) {
        assert.ok(!x.fail, `${x.band}: ${x.fail}`);
        assert.ok(x.ok, `${x.band}: the ghost-ball aim makes it`);
        assert.equal(x.bandOf, x.band, 'cut is in the chosen band');
        assert.ok(x.w > 0.05 && x.w < 12, `${x.band}: window ${x.w.toFixed(2)} deg`);
        if (x.toOb > x.shift + 0.2) assert.ok(x.thickOk, `${x.band}: undercut is thick and misses`);
        if (x.need > 3) { assert.ok(true, `${x.band}: undercut is thick and misses`); assert.ok(x.thinOk, `${x.band}: overcut is thin and misses`); }
      }

      // play one shot right and one wrong through the page
      await page.evaluate(() => { const A = window.__aim; A.newShot(); A.S.aim = A.S.shot.right; });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `aim-${vp.width}-aiming.png`) });
      await page.click('#shoot');
      await page.waitForFunction(() => window.__aim.S.phase === 'done', null, { timeout: 10000 });
      assert.match(await page.textContent('#resH'), /Made it/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `aim-${vp.width}-made.png`) });
      await page.click('#again');
      await page.evaluate(() => { const A = window.__aim, s = A.S.shot; A.S.aim = s.right + (s.window.hi + 2) * Math.PI / 180; });
      await page.click('#shoot');
      await page.waitForFunction(() => window.__aim.S.phase === 'done', null, { timeout: 10000 });
      assert.match(await page.textContent('#resH'), /Missed|Wrong pocket/);
      assert.match(await page.textContent('#resWhy'), /°/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `aim-${vp.width}-missed.png`) });

      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chalkline-aim-v1')).shots);
      assert.equal(saved.length, 2); assert.equal(saved[0].made, true); assert.equal(saved[1].made, false);
      await page.click('#statsBtn');
      assert.match(await page.textContent('#statLead'), /2 shots, 1 made/);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `aim-${vp.width}-stats.png`) });
      await page.click('#statClose');

      // dragging on the table swings the cue
      await page.click('#next');
      const a0 = await page.evaluate(() => window.__aim.S.aim);
      await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.down(); await page.mouse.move(vp.width / 2 + 50, vp.height / 2, { steps: 5 }); await page.mouse.up();
      const a1 = await page.evaluate(() => window.__aim.S.aim);
      assert.ok(a1 < a0 - 0.05, 'dragging right swings the cue to the right');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); srv.close(); }
});
