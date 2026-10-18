// Browser test for the test recorder (recorder/index.html): with a fake camera and every wait shortened, it runs the
// camera check, a still clip and a shot with its question, then saves a file and checks the zip inside.
// Run: node --test "tests/*.test.js"   (needs Playwright: npm install)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..');

test('recorder records clips, asks the shot question, and saves a valid zip under the limit', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera', 'microphone'], acceptDownloads: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/recorder/index.html');
    await page.waitForFunction(() => window.__rec);
    await page.evaluate(() => window.__rec.setSpeed(0.05));
    await page.selectOption('#fShort', '1'); // short version: fewer steps
    await page.click('#go');
    await page.click('#recBtn'); // camera check
    await page.waitForSelector('#cont', { timeout: 30000 });
    const caps = await page.evaluate(() => window.__rec.S.caps);
    assert.ok(caps.samples.length === 4, 'four camera samples tried');
    assert.ok(caps.samples.some(s => s.bytes > 0), 'at least one sample recorded');
    await page.click('#cont');
    await page.click('#recBtn'); // empty table
    await page.waitForFunction(() => window.__rec.S.step === 1, null, { timeout: 15000 });
    // jump to the first straight-in shot of the short version
    await page.evaluate(() => { const s = window.__rec.S, secs = window.__rec.steps(); s.sec = secs.findIndex(x => x.id === 'shots'); s.step = 0; window.__rec.save(); });
    await page.goto(srv.url + '/recorder/index.html'); // also checks carrying on after a reload
    await page.waitForFunction(() => window.__rec);
    await page.evaluate(() => window.__rec.setSpeed(0.05));
    await page.click('#resume');
    await page.waitForSelector('#recBtn');
    assert.match(await page.textContent('#panel'), /Straight in/);
    await page.evaluate(() => window.__rec.S.stream.getAudioTracks()[0].stop()); // the phone takes the mic away between clips
    await page.click('#recBtn');
    await page.waitForSelector('.balls', { timeout: 15000 });
    await page.click('[data-b="1"]');
    await page.click('#offN');
    await page.click('#done');
    await page.waitForSelector('#saveNow:not([disabled])');
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('#saveNow'); await page.click('#share'); })()]);
    assert.match(dl.suggestedFilename(), /^chalkline-R\d+\.\d+-\d{8}-\d{4}-part01\.zip$/);
    const zipPath = path.join(os.tmpdir(), 'rec-test.zip'); await dl.saveAs(zipPath);
    const listing = JSON.parse(execFileSync('python3', ['-c', 'import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); z.testzip(); print(json.dumps({"names": z.namelist(), "meta": json.loads(z.read("meta.json"))}))', zipPath]).toString());
    assert.ok(fs.statSync(zipPath).size < 30 * 1048576, 'zip under 30 MB');
    assert.strictEqual(listing.names[0], 'meta.json');
    const shot = listing.meta.clips.find(c => c.step === 'straightA');
    assert.ok(shot, 'the shot clip is in the file');
    assert.deepStrictEqual(shot.answers, { in: [1], offTable: false });
    assert.deepStrictEqual(shot.mic, ['ok', 'ok'], 'the mic was reconnected before the shot');
    assert.ok(listing.names.includes(shot.name + '-motion.json'));
    assert.ok(listing.meta.clips.some(c => c.step === 'empty'));
    assert.ok(listing.meta.camera && listing.meta.camera.locks, 'camera check results are in the file');
    await page.click('#savedIt');
    await page.waitForFunction(() => window.__rec.S.pending.length === 0 && window.__rec.S.part === 2, null, { timeout: 5000 });
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
