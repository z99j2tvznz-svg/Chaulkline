// Browser test for the recorder's cue-ball test session (recorder/index.html, R0.8): with a fake camera and every wait
// shortened, it records one event of each test (A placement, B box, C lag, D speed), fills in each measurement form,
// skips the rest, saves the file and checks that every clip carries its event name and the measurements typed in.
// Run: node --test "tests/*.test.js"   (needs Playwright: npm install)
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..');

test('cue-ball test: pictures, one clip per event, measurements stored with each clip', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, permissions: ['camera', 'microphone'], acceptDownloads: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/recorder/index.html');
    await page.waitForFunction(() => window.__rec);
    await page.evaluate(() => window.__rec.setSpeed(0.05));
    assert.deepStrictEqual(await page.evaluate(() => window.__rec.CUEBALL.map(s => s.steps.filter(x => x.kind !== 'note').length)), [8, 10, 10, 10], '38 events');
    await page.selectOption('#fShort', '4');
    await page.click('#go');
    await page.waitForSelector('#recBtn');
    assert.match(await page.textContent('#panel'), /Test A/);
    assert.ok(await page.isVisible('svg.lay'), 'a picture of where to put the ball');
    const skip = async n => { for (let i = 0; i < n; i++) { await page.waitForSelector('#skipBtn'); await page.click('#skipBtn'); } };
    const fill = async (a, b) => { await page.fill('#m1', a); if (b != null) await page.fill('#m2', b); };
    // A1: a placement, two distances
    await page.click('#recBtn');
    await page.waitForSelector('#cueSave', { timeout: 15000 });
    assert.ok(await page.isDisabled('#cueSave'), 'Next waits for the numbers');
    await fill('8.5', '8.75'); await page.click('#cueSave');
    await skip(7);
    // B: the set-up picture, then B1 ended with Shot done, in the box
    await page.waitForSelector('#noteOk'); assert.ok(await page.isVisible('svg.lay')); await page.click('#noteOk');
    await page.waitForSelector('#recBtn'); await page.click('#recBtn');
    await page.waitForSelector('#shotDone:not([disabled])', { timeout: 15000 }); await page.click('#shotDone');
    await page.waitForSelector('#cueSave', { timeout: 15000 });
    await fill('18', '17.5'); assert.ok(await page.isDisabled('#cueSave'), 'in or out still to answer');
    await page.click('#pIn [data-v="in"]'); await page.click('#cueSave');
    await skip(9);
    // C1: the lag, touched unsure
    await page.waitForSelector('#recBtn'); await page.click('#recBtn');
    await page.waitForSelector('#cueSave', { timeout: 30000 });
    await fill('1.25'); await page.click('#pTouch [data-v="unsure"]'); await page.click('#cueSave');
    await skip(9);
    // D1: soft, rest measured from the right and far rails, one rail hit; D2 could not be measured
    await page.waitForSelector('#recBtn'); await page.click('#recBtn');
    await page.waitForSelector('#cueSave', { timeout: 30000 });
    await page.selectOption('#r1', 'right'); await page.selectOption('#r2', 'far');
    await fill('30', '18'); await page.click('#pRails [data-v="1"]'); await page.click('#cueSave');
    await page.waitForSelector('#recBtn'); await page.click('#recBtn');
    await page.waitForSelector('#cueSkip', { timeout: 30000 }); await page.click('#cueSkip');
    await skip(8);
    await page.waitForSelector('#last');
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#last'); await page.click('#share'); })()]);
    const zipPath = path.join(os.tmpdir(), 'rec-cueball.zip'); await dl.saveAs(zipPath);
    const meta = JSON.parse(execFileSync('python3', ['-c', 'import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read("meta.json").decode())', zipPath]).toString());
    assert.strictEqual(meta.version, 'R0.8');
    assert.strictEqual(meta.setup.cueball, true);
    assert.deepStrictEqual(meta.clips.map(c => c.step), ['A1', 'B1', 'C1', 'D1', 'D2']);
    assert.deepStrictEqual(meta.clips.map(c => c.answers), [
      { event: 'A1', measured: { left: 8.5, near: 8.75 } },
      { event: 'B1', measured: { right: 18, near: 17.5 }, inBox: 'in' },
      { event: 'C1', measured: { right: 1.25 }, touched: 'unsure' },
      { event: 'D1', measured: { right: 30, far: 18 }, railsHit: '1', speed: 'soft' },
      { event: 'D2', skipped: true }]);
    assert.strictEqual(meta.clips[1].stoppedEarly, true);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
