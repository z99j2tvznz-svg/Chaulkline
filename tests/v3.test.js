// V3 app end to end in headless Chromium: the camera is a video made from the owner's photo of Oct 27 (home 7 ft table,
// low side view, balls bunched at one end). Sideways and upright: the table is found, the finder starts (CPU engine here),
// the balls get rings and names, a tap renames a ball and the name sticks, the watcher keeps up, the stroke test walks its
// stations and records a clip, End session turns the camera off, and Save debug there gives a zip with the log and the clip.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..'), PHOTO = path.join(ROOT, 'tests/fixtures/v3/owner-20261027-bunched.jpg');
const VERSION = fs.readFileSync(path.join(ROOT, 'src/v3/app.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];

async function run(rot, viewport, sway, strokeTest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-v3-')), y4m = path.join(dir, 'cam.y4m');
  execFileSync('python3', [path.join(ROOT, 'tests/lib/y4m.py'), PHOTO, y4m, sway ? '90' : '3', String(rot), String(sway || 0)]);
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m, '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport, permissions: ['camera'], acceptDownloads: true }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html');
    // sw.js makes the page cross-origin isolated (the first visit reloads once), so the finder gets several cores
    await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    assert.strictEqual((await page.textContent('#verTag')).trim(), VERSION);
    await page.click('#goBtn');
    await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 60000 });
    assert.match(await page.textContent('#card'), /Table found/);
    await page.click('[data-act=accept]');
    await page.waitForFunction(() => window.__v3.A.phase === 'run' && window.__v3.A.looks >= 12, null, { timeout: 200000 });
    const st = await page.evaluate(() => { const A = window.__v3.A, D = window.__v3.DBG; return { balls: A.tk.balls().map(b => ({ key: b.key, num: b.num, sure: b.sure, state: b.state })), shots: A.tk.S.shots.length, phase: A.tk.S.phase,
      threads: DET.threads(), ep: DET.ep, hands: A.tk.S.events.filter(e => e.k === 'hands').length, steady: D.ev.filter(e => e.k === 'steady').map(e => e.shift) }; });
    assert.ok(st.threads > 1, 'finder threads: ' + st.threads); assert.strictEqual(st.ep, 'wasm');
    if (sway) { assert.ok(st.steady.some(s => Math.abs(s[0]) >= 4), 'the outline followed the sway: ' + JSON.stringify(st.steady)); assert.strictEqual(st.hands, 0); assert.ok(st.balls.every(b => b.state === 'rest'), 'balls rest while the phone sways'); }
    assert.ok(st.balls.length >= 7, 'balls on the table: ' + st.balls.length);
    assert.ok(st.balls.some(b => b.num === 0 && b.sure), 'the cue ball is named');
    assert.ok(st.balls.filter(b => b.num != null).length >= 4, 'named: ' + JSON.stringify(st.balls));
    assert.strictEqual(st.shots, 0, 'a still picture is never a shot');
    // tap an unnamed ball and call it the 4: the name sticks through more looks
    const target = await page.evaluate(() => { const A = window.__v3.A, b = A.tk.balls().find(x => x.num == null) || A.tk.balls()[0], p = A.cam.proj(b.x, b.y, A.P.R), ov = document.querySelector('#ov'), rc = ov.getBoundingClientRect(), k = Math.min(ov.clientWidth / A.W, ov.clientHeight / A.H);
      return { key: b.key, x: rc.left + (ov.clientWidth - A.W * k) / 2 + p[0] * k, y: rc.top + (ov.clientHeight - A.H * k) / 2 + p[1] * k }; });
    await page.mouse.click(target.x, target.y);
    await page.waitForSelector('#sheet:not([hidden])');
    await page.click('#pickGrid button:nth-child(5)'); // cue, 1, 2, 3, 4
    const n0 = await page.evaluate(() => window.__v3.A.looks);
    await page.waitForFunction(n => window.__v3.A.looks >= n + 4, n0, { timeout: 60000 });
    const after = await page.evaluate(k => { const b = window.__v3.A.tk.S.tracks.find(t => t.key === k); return b && [b.num, b.sure, b.pin]; }, target.key);
    assert.deepStrictEqual(after, [4, true, 4]);
    // V3.1.0: the watcher takes camera frames alongside the finder and logs how fast once a second (here a few a second:
    // a fake camera and a slow processor; how fast it keeps up on the phone is what the logs are for)
    const w = await page.evaluate(() => window.__v3.DBG.ev.filter(e => e.k === 'watch').map(e => e.fps));
    assert.ok(w.length >= 2 && Math.max(...w) >= 1, 'watcher frames a second: ' + JSON.stringify(w));
    if (strokeTest) {
      // Menu -> Stroke test: station 1's spots lie on the table, the card walks through the stations, and a move recorded
      // at station 5 becomes a clip in the debug file
      await page.click('#menuBtn'); await page.click('[data-act=test]');
      const sp = await page.evaluate(() => { const v = window.__v3; return v.STATIONS.map(S => [v.testXY(S.cue), v.testXY(S.obj)]).concat([[v.A.P.L, v.A.P.W]]); });
      const [L, W] = sp.pop(); for (const pr of sp) for (const [x, y] of pr) assert.ok(x > 0 && x < L && y > 0 && y < W, 'spot on the table: ' + JSON.stringify(sp));
      assert.match(await page.textContent('#card'), /Soft.*Station 1 of 5/);
      for (let i = 0; i < 4; i++) await page.click('[data-act=test_next]');
      assert.match(await page.textContent('#card'), /Practice strokes.*Station 5 of 5/);
      await page.click('[data-act=test_rec]');
      await page.waitForFunction(() => window.__v3.DBG.ev.some(e => e.k === 'clip' && e.name === 'move-01'), null, { timeout: 60000 }); // 10 s countdown, 8 s recorded
      await page.click('[data-act=test_close]');
    }
    // End session: the camera goes off and the session screen shows; Save debug there (no share sheet in headless
    // Chromium: it downloads)
    await page.click('#endBtn'); await page.waitForFunction(() => !document.querySelector('#sum').hidden);
    assert.deepStrictEqual(await page.evaluate(() => [window.__v3.A.live, !!window.__v3.A.stream, document.querySelector('#cam').hidden]), [false, false, true]);
    const dl = page.waitForEvent('download'); await page.click('#sumDbg'); const d = await dl, zp = path.join(dir, 'dbg.zip'); await d.saveAs(zp);
    const zip = fs.readFileSync(zp); assert.ok(zip.includes(Buffer.from('log.json')) && zip.includes(Buffer.from('taps/001-4.png')) && zip.includes(Buffer.from('find-01.jpg')), 'zip holds the log, the tapped ball and the table-finding picture');
    if (strokeTest) assert.ok(zip.includes(Buffer.from('clips/move-01/index.json')) && zip.includes(Buffer.from('clips/move-01/000.jpg')), 'zip holds the recorded clip');
    assert.deepStrictEqual(errors, []);
    return st;
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('V3 sideways: table, balls, names, a tap that sticks, the watcher, the stroke test, Save debug', { timeout: 400000 }, async () => { console.log('sideways:', JSON.stringify(await run(0, { width: 956, height: 440 }, 0, true))); });
test('V3 upright: the same with the phone standing up', { timeout: 400000 }, async () => { console.log('upright:', JSON.stringify(await run(90, { width: 440, height: 956 }))); });
test('V3 on a swaying phone: the outline follows, the balls stay at rest, no hands or shots', { timeout: 500000 }, async () => { const st = await run(0, { width: 956, height: 440 }, 10); console.log('sway:', JSON.stringify({ steady: st.steady.slice(-6), threads: st.threads })); });
