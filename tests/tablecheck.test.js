// V3.24 Table check end to end in headless Chromium (the owner's Oct 27 photo as the camera): a spot found, fine-tuned on the
// rail diamonds and reported rail by rail with where the phone is; the five-ball check (balls set by hand into the tracker)
// measures each across its cushion and fits the reading height, used at once, and the height and the cushions' inset
// together (V3.24.4); spots saved and kept; a second spot checked again; the spots put together; the list
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
    // (V3.24.4: balls are read 0.95 in up with the diamonds 1.6 in up, lower by as much as the outline was fitted lower; the
    // cushion noses 0.6 in inside the outline found)
    const bz = await page.evaluate(() => [window.__v3.A.ballZ, window.__v3.A.edge, edgeIn(true)]); // (corners set by hand: on the noses)
    assert.ok(Math.abs(bz[0] - Math.max(-0.5, Math.min(1.5, 0.95 + fit.z - 1.6))) < 0.011 && bz[1] === 0.6 && bz[2] === 0, bz + ' ' + fit.z);
    // the ball check (V3.24.3): five numbered balls left on the table for every spot, frozen against the cushions at diamonds;
    // set half round from the default way (as if the phone were on the far side), which the app works out from where they
    // are. Made up as a camera would see them if the noses were 0.9 in inside the outline and the finder's centres 0.6 in up
    // (with the diamonds at 1.6), and read at a ball's middle height with the 0.6 inset: off. Capture reads them; the height
    // alone is fitted for the session at once, and the height and inset together (V3.24.4) come out as made
    const H16 = 0.6, E = 0.9;
    const check = () => page.evaluate(async ([H16, E]) => { const A = window.__v3.A, T = A.tchk; A.ballZ = A.P.R; const flip0 = T.balls.m.flip, lay = tcLayout(!flip0);
      const zd = (A.diaFit && A.diaFit.d && A.diaFit.d.n >= 8 ? A.diaFit.d.z : 1.6) - 1.6, truth = tableCam(A.quad, A.rot, A.W, A.H, E);
      const fake = lay.map((g, i) => { const im = truth.proj(g.at[0], g.at[1], H16 + zd), p = A.cam.unproj(im[0], im[1], A.ballZ); return { key: 900 + i, num: g.num, x: p[0], y: p[1], state: 'rest', restSince: 0 }; });
      const real = A.tk.balls; A.tk.balls = () => fake; tcLook(); const m = T.balls.m; tcCapture(); A.tk.balls = real; const b = T.cur.balls;
      return { flip0, flip: m.flip, n: m.n, cur: b.map(x => x), hFit: b.hFit, side: b.side, z: A.ballZ, cq: b.cq, edge: b.edge, fitHE: b.fitHE, card: document.querySelector('#card').textContent }; }, [H16, E]);
    await page.click('[data-act=tc_balls]'); assert.match(await page.textContent('#card'), /The five balls.*the 1 against the far rail/s);
    await page.click('[data-act=tc_rings]'); assert.match(await page.textContent('#drillTag'), /numbered rings/); assert.match(await page.textContent('#card'), /Capture the balls/);
    const bc = await check(); console.log('ball check:', JSON.stringify(bc).slice(0, 500));
    assert.strictEqual(bc.flip, !bc.flip0, 'worked out the way round from the balls'); assert.strictEqual(bc.n, 5);
    assert.ok(bc.cur && bc.cur.length === 5 && bc.cur.some(x => Math.abs(x.now) > 0.2), 'off as read: ' + JSON.stringify(bc.cur));
    assert.ok(bc.z === bc.hFit && bc.cq && bc.cq.length === 4 && bc.edge === 0.6, 'the height fitted is used now; the outline at the capture kept');
    assert.ok(bc.fitHE && Math.abs(bc.fitHE.h16 - H16) < 0.051 && Math.abs(bc.fitHE.e - E) < 0.051, 'height and inset as made: ' + JSON.stringify(bc.fitHE));
    assert.match(bc.card, /The five balls say the phone is /); assert.match(bc.card, /read truest taken/);
    await page.click('[data-act=tc_save]'); assert.match(await page.textContent('#card'), /Spot 1 saved/);
    // a second spot (the same picture here), with the balls checked again
    await page.click('[data-act=tc_next]'); await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 60000 });
    assert.match(await page.textContent('#card'), /Spot 2/);
    await page.click('[data-act=accept]'); await page.waitForFunction(() => /Spot 2/.test(document.querySelector('#card').textContent) && /Save this spot/.test(document.querySelector('#card').textContent), null, { timeout: 60000 });
    await page.click('[data-act=tc_balls]'); if (await page.$('[data-act=tc_rings]')) await page.click('[data-act=tc_rings]');
    const bc2 = await check(); assert.strictEqual(bc2.n, 5);
    await page.click('[data-act=tc_save]'); const saved2 = await page.textContent('#card'); assert.match(saved2, /Spot 2 saved/);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('chalkline.v3.tchk.' + window.__v3.A.ft) || '[]'));
    assert.strictEqual(kept.length, 2); assert.ok(kept[0].balls && kept[0].balls.cq && kept[0].rep.phone && kept[0].quad.length === 4);
    if (/Put the spots together/.test(saved2)) {
      await page.click('[data-act=tc_combine]'); await page.waitForFunction(() => /spots put together/.test(document.querySelector('#card').textContent), null, { timeout: 120000 });
      const dia = await page.evaluate(() => JSON.parse(localStorage.getItem('chalkline.v3.dia.' + window.__v3.A.ft) || 'null')); assert.ok(dia && dia.n === 2 && isFinite(dia.D), JSON.stringify(dia));
      const got = await page.evaluate(() => ({ bz: JSON.parse(localStorage.getItem('chalkline.v3.ballz2') || 'null'), e: edgeIn(), z: window.__v3.A.ballZ, card: document.querySelector('#card').textContent }));
      assert.ok(got.bz && got.bz.n === 2 && Math.abs(got.bz.h16 - H16) < 0.051 && Math.abs(got.bz.e - E) < 0.051 && Math.abs(got.e - E) < 0.051, JSON.stringify(got));
      assert.match(got.card, /2 ball checks together: the cushions 0\.9 in inside the outline found/);
    }
    await page.click('#menuBtn'); assert.match(await page.textContent('#card'), /Table check: next spot/); await page.click('[data-act=tc_done]');
    assert.match(await page.textContent('#card'), /Spot 1 .*Spot 2/s);
    assert.ok((await page.evaluate(() => window.__v3.DBG.ev.filter(e => e.k === 'tchk_spot').length)) === 2);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('V3.25.1: the table set by hand from the eight cushion points comes out on the cloth', { timeout: 300000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-tc-')), y4m = path.join(dir, 'cam.y4m');
  execFileSync('python3', [path.join(ROOT, 'tests/lib/y4m.py'), PHOTO, y4m, '3', '0', '0']);
  const srv = await serve(ROOT), browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera'] })).newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    await page.click('#tchkBtn'); await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 60000 });
    assert.match(await page.textContent('#card'), /Tap the rail points/);
    // the table the automatic outline found stands in for the real one: its cushion points at the noses' height, shuffled
    const set = await page.evaluate(() => { const A = window.__v3.A, c = A.cand, { L, Wd } = tableDims(A.ft), cam = tableCam(c.quad, c.rot, A.W, A.H, edgeIn(false)), pts = [];
      for (const [x, y] of [[0, 0], [L, 0], [L, Wd], [0, Wd]]) { const sx = x ? -1 : 1, sy = y ? -1 : 1; pts.push(cam.proj(x + 3.4 * sx, y, 1.4), cam.proj(x, y + 3.4 * sy, 1.4)); }
      const order = [5, 2, 7, 0, 3, 6, 1, 4], cloth = tableCornersFor(c.rot, L, Wd).map(([x, y]) => cam.proj(x, y, 0));
      beginManual(); A.man = order.map(i => pts[i]); manualCard(); return { cloth, rot: c.rot, card: document.querySelector('#card').textContent };
    });
    assert.match(set.card, /Use these points/);
    await page.click('[data-act=useman]'); await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 30000 });
    const got = await page.evaluate(() => { const c = window.__v3.A.cand; return { quad: c.quad, rot: c.rot, manual: c.manual, rails: c.rails, ev: window.__v3.DBG.ev.filter(e => e.k === 'table_manual').pop() }; });
    assert.ok(got.manual && got.rails && got.rot === set.rot && got.ev && got.ev.pts.length === 8, JSON.stringify(got).slice(0, 300));
    for (const p of set.cloth) { const d = Math.min(...got.quad.map(q => Math.hypot(q[0] - p[0], q[1] - p[1]))); assert.ok(d < 2, 'each corner on the cloth within 2 px: ' + d.toFixed(2)); }
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
