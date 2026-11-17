// V3.24 Table check end to end in headless Chromium (the owner's Oct 27 photo as the camera): a spot found, fine-tuned on the
// rail diamonds and reported rail by rail with where the phone is; the four-ball check (balls set by hand into the tracker)
// measures each across its cushion and fits the reading height, used at once; spots saved and kept; a second spot; the
// spots put together; the list
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');
const ROOT = path.join(__dirname, '..'), PHOTO = path.join(ROOT, 'tests/fixtures/v3/owner-20261027-bunched.jpg');

test('V3.24 table check: two spots, the ball check, put together', { timeout: 400000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-tc-')), y4m = path.join(dir, 'cam.y4m');
  execFileSync('python3', [path.join(ROOT, 'tests/lib/y4m.py'), PHOTO, y4m, '3', '0', '0']);
  const srv = await serve(ROOT), browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera'] })).newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/tchk|\.dia\.|ballz/.test(k)) localStorage.removeItem(k); });
    await page.click('#tchkBtn'); await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 60000 });
    assert.match(await page.textContent('#card'), /Spot 1: move the phone/); assert.match(await page.textContent('#card'), /Use this spot/);
    await page.click('[data-act=accept]');
    await page.waitForFunction(() => /Spot 1/.test(document.querySelector('#card').textContent) && /Save this spot/.test(document.querySelector('#card').textContent), null, { timeout: 200000 });
    const card1 = await page.textContent('#card'); console.log('spot 1:', card1.replace(/\s+/g, ' ').slice(0, 400));
    assert.match(card1, /Fine-tuned on \d+ of 18 rail diamonds/); assert.match(card1, /far rail: /); assert.match(card1, /behind the near rail/);
    const fit = await page.evaluate(() => window.__v3.DBG.ev.find(e => e.k === 'diamonds')); assert.ok(fit.D >= 1.5 && fit.D <= 6.5 && [0, 0.8, 1.6].includes(fit.z), JSON.stringify(fit));
    // the ball check: four balls frozen at the rings, as the finder sees them (its centre where the ball meets the cloth) and
    // read at the old height (a ball's radius up), so each reads toward the phone; the fit finds the cloth again
    await page.click('[data-act=tc_balls]'); assert.match(await page.textContent('#drillTag'), /Freeze a ball against each cushion/);
    const bc = await page.evaluate(async () => { const A = window.__v3.A, T = A.tchk, tg = T.balls.targets; A.ballZ = A.P.R;
      const fake = tg.map((g, i) => { const im = A.cam.proj(g.at[0], g.at[1], 0), p = A.cam.unproj(im[0], im[1], A.P.R); return { key: 900 + i, num: i + 1, x: p[0], y: p[1], state: 'rest', restSince: 0 }; });
      const real = A.tk.balls; A.tk.balls = () => fake; tcLook(); await new Promise(r => setTimeout(r, 1600)); tcLook(); A.tk.balls = real;
      return { cur: T.cur.balls, hFit: T.cur.balls.hFit, z: A.ballZ, card: document.querySelector('#card').textContent }; });
    console.log('ball check:', JSON.stringify(bc.cur).slice(0, 300));
    assert.ok(bc.cur && bc.cur.length === 4 && bc.cur.some(x => Math.abs(x.now) > 0.5), 'off as read at a ball\'s middle: ' + JSON.stringify(bc.cur));
    assert.ok(Math.abs(bc.hFit) <= 0.1 && bc.cur.every(x => Math.abs(x.atFit) <= 0.15) && bc.z === bc.hFit, 'the fit finds the cloth and is used now: ' + JSON.stringify(bc.cur));
    assert.match(bc.card, /read truest taken/);
    await page.click('[data-act=tc_save]'); assert.match(await page.textContent('#card'), /Spot 1 saved/);
    // a second spot (the same picture here)
    await page.click('[data-act=tc_next]'); await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 60000 });
    assert.match(await page.textContent('#card'), /Spot 2/);
    await page.click('[data-act=accept]'); await page.waitForFunction(() => /Spot 2/.test(document.querySelector('#card').textContent) && /Save this spot/.test(document.querySelector('#card').textContent), null, { timeout: 60000 });
    await page.click('[data-act=tc_save]'); const saved2 = await page.textContent('#card'); assert.match(saved2, /Spot 2 saved/);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('chalkline.v3.tchk.' + window.__v3.A.ft) || '[]'));
    assert.strictEqual(kept.length, 2); assert.ok(kept[0].balls && kept[0].rep.phone && kept[0].quad.length === 4);
    if (/Put the spots together/.test(saved2)) {
      await page.click('[data-act=tc_combine]'); await page.waitForFunction(() => /spots put together/.test(document.querySelector('#card').textContent), null, { timeout: 120000 });
      const dia = await page.evaluate(() => JSON.parse(localStorage.getItem('chalkline.v3.dia.' + window.__v3.A.ft) || 'null')); assert.ok(dia && dia.n === 2 && isFinite(dia.D), JSON.stringify(dia));
    }
    await page.click('#menuBtn'); assert.match(await page.textContent('#card'), /Table check: next spot/); await page.click('[data-act=tc_done]');
    assert.match(await page.textContent('#card'), /Spot 1 .*Spot 2/s);
    assert.ok((await page.evaluate(() => window.__v3.DBG.ev.filter(e => e.k === 'tchk_spot').length)) === 2);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
