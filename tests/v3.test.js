// V3 app end to end in headless Chromium: the camera is a video made from the owner's photo of Oct 27 (home 7 ft table,
// low side view, balls bunched at one end). Sideways and upright: the table is found, the finder starts (CPU engine here),
// the balls get rings and names, a tap renames a ball and the name sticks, Save debug gives a zip with the log.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..'), PHOTO = path.join(ROOT, 'tests/fixtures/v3/owner-20261027-bunched.jpg');
const VERSION = fs.readFileSync(path.join(ROOT, 'src/v3/app.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];

async function run(rot, viewport) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chalk-v3-')), y4m = path.join(dir, 'cam.y4m');
  execFileSync('python3', [path.join(ROOT, 'tests/lib/y4m.py'), PHOTO, y4m, '3', String(rot)]);
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + y4m, '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport, permissions: ['camera'], acceptDownloads: true }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html');
    assert.strictEqual((await page.textContent('#verTag')).trim(), VERSION);
    await page.click('#goBtn');
    await page.waitForFunction(() => window.__v3.A.phase === 'verify', null, { timeout: 60000 });
    assert.match(await page.textContent('#card'), /Table found/);
    await page.click('[data-act=accept]');
    await page.waitForFunction(() => window.__v3.A.phase === 'run' && window.__v3.A.looks >= 12, null, { timeout: 200000 });
    const st = await page.evaluate(() => { const A = window.__v3.A; return { balls: A.tk.balls().map(b => ({ key: b.key, num: b.num, sure: b.sure })), shots: A.tk.S.shots.length, phase: A.tk.S.phase }; });
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
    // Save debug (no share sheet in headless Chromium: it downloads)
    const dl = page.waitForEvent('download'); await page.click('#dbgBtn'); const d = await dl, zp = path.join(dir, 'dbg.zip'); await d.saveAs(zp);
    const zip = fs.readFileSync(zp); assert.ok(zip.includes(Buffer.from('log.json')) && zip.includes(Buffer.from('taps/001-4.png')), 'zip holds the log and the tapped ball');
    assert.deepStrictEqual(errors, []);
    return st;
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('V3 sideways: table, balls, names, a tap that sticks, Save debug', { timeout: 400000 }, async () => { console.log('sideways:', JSON.stringify(await run(0, { width: 956, height: 440 }))); });
test('V3 upright: the same with the phone standing up', { timeout: 400000 }, async () => { console.log('upright:', JSON.stringify(await run(90, { width: 440, height: 956 }))); });
