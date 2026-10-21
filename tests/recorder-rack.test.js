// Browser test for the recorder's continuous rack session (recorder/index.html): with a fake camera it records one rack
// in one go, is cut off once and carries on as a second segment, saves every file, and checks that the pieces join back
// into exactly the recorded videos and that those decode. A second test closes the page mid-recording and checks that
// what reached storage is kept.
// Desktop Chromium writes mp4 in fragments of a few seconds, so the waits are longer than one chunk a second needs.
// Run: node --test "tests/*.test.js"   (needs Playwright: npm install; ffprobe is used when installed)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..');
const ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
const hasFfprobe = (() => { try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();

async function openRackMode(page, url) {
  await page.goto(url + '/recorder/index.html');
  await page.waitForFunction(() => window.__rec);
  await page.selectOption('#fShort', '3');
  await page.click('#go');
  await page.waitForSelector('#rackGo');
}

test('continuous rack: one recording, a cut-off carried on as part 2, saved as files that join back exactly', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ARGS });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rack-'));
  try {
    const ctx = await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera', 'microphone'], acceptDownloads: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await openRackMode(page, srv.url);
    assert.match(await page.textContent('#panel'), /Rack 1/);
    await page.evaluate(() => window.__rec.setRackPart(400 * 1024)); // small files, so a short recording needs several
    await page.selectOption('#fGame', '10-ball');
    await page.click('#rackGo');
    await page.waitForSelector('#stopRack:not(.hidden)');
    assert.ok(await page.isHidden('#panel'), 'nothing to answer while recording');
    await page.waitForTimeout(8000);
    assert.ok(await page.evaluate(() => window.__rec.RK.rec.seg.bytes > 0), 'video reaches storage while still recording');
    // the camera is taken away mid-rack: the recording is kept and carries on as part 2
    await page.evaluate(() => window.__rec.S.stream.getVideoTracks()[0].stop());
    await page.waitForSelector('#goOn', { timeout: 10000 });
    await page.click('#goOn');
    await page.waitForSelector('#stopRack:not(.hidden)');
    await page.waitForTimeout(7000);
    await page.click('#stopRack'); await page.click('#cfNo'); // an accidental tap does nothing
    assert.ok(await page.evaluate(() => !!window.__rec.RK.rec), 'still recording after Keep recording');
    await page.click('#stopRack'); await page.click('#cfYes');
    await page.waitForSelector('#nextPart', { timeout: 15000 });
    const rack = await page.evaluate(() => window.__rec.RK.racks[0]);
    assert.strictEqual(rack.segs.length, 2);
    assert.strictEqual(rack.game, '10-ball');
    assert.match(rack.segs[0].end, /camera/); assert.strictEqual(rack.segs[1].end, 'stopped');
    for (const g of rack.segs) {
      assert.ok(g.bytes > 0 && g.chunks.length >= 2, 'chunks written while recording');
      assert.strictEqual(g.chunks.reduce((a, c) => a + c[3], 0), g.bytes);
      assert.ok(g.chunks.every((c, i) => i === 0 || c[2] >= g.chunks[i - 1][2]), 'chunk times in order');
    }
    assert.ok(rack.segs[0].frames.length >= 3 && rack.segs[0].frames.every(f => f[1] > 0), 'frame rate logged each second');
    const nParts = (await page.evaluate(() => window.__rec.rackPlan(window.__rec.RK.racks[0]))).length;
    assert.ok(nParts >= 3, 'several files: ' + nParts);
    const zips = [];
    for (let k = 1; k <= nParts; k++) {
      await page.click('#nextPart'); // packs
      await page.waitForFunction(k => /Save file \d+ \(/.test(document.querySelector('#nextPart').textContent), k, { timeout: 15000 });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#nextPart')]);
      assert.match(dl.suggestedFilename(), new RegExp('^chalkline-R\\d+\\.\\d+-\\d{8}-\\d{4}-rack1-part' + String(k).padStart(2, '0') + '-of-' + String(nParts).padStart(2, '0') + '\\.zip$'));
      const zp = path.join(dir, dl.suggestedFilename()); await dl.saveAs(zp); zips.push(zp);
      assert.ok(fs.statSync(zp).size < 400 * 1024, 'file under the limit');
      await page.waitForSelector('#nextPart');
    }
    assert.match(await page.textContent('#nextPart'), /All files saved/);
    assert.ok(await page.evaluate(() => window.__rec.RK.racks[0].saved));
    // unpack every file and join the pieces back
    const out = JSON.parse(execFileSync('python3', ['-c', `
import zipfile, json, sys, os
d = sys.argv[1]; metas = []
for z in sys.argv[2:]:
    f = zipfile.ZipFile(z); assert f.testzip() is None; f.extractall(d); metas.append(json.loads(f.read('meta.json')))
m = metas[0]; vids = {}
for p in m['files']:
    for x in p['files']:
        if 'video' in x: vids.setdefault(x['video'], []).append(x)
res = {}
for v, ps in vids.items():
    ps.sort(key=lambda x: x['name'])
    data = b''.join(open(os.path.join(d, x['name']), 'rb').read() for x in ps)
    assert [x['from'] for x in ps][1:] == [x['to'] for x in ps][:-1]
    open(os.path.join(d, v), 'wb').write(data); res[v] = len(data)
mo = [n for n in os.listdir(d) if n.endswith('-motion.json')]
print(json.dumps({'videos': res, 'parts': [x['part'] for x in metas], 'kinds': list({x['kind'] for x in metas}), 'segs': [s['bytes'] for s in m['segments']], 'motion': sorted(mo)}))
`, dir, ...zips]).toString());
    assert.deepStrictEqual(out.parts, [...Array(nParts)].map((_, i) => i + 1));
    assert.deepStrictEqual(out.kinds, ['continuous-rack']);
    assert.deepStrictEqual(Object.values(out.videos), out.segs, 'joined videos are exactly the recorded bytes');
    assert.strictEqual(out.motion.length, 2, 'a motion file for each segment');
    if (hasFfprobe) for (const v of Object.keys(out.videos)) {
      const secs = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', path.join(dir, v)]).toString());
      assert.ok(secs > 30, v + ' decodes with video frames: ' + secs);
    }
    // deleting after saving
    page.on('dialog', d => d.accept());
    await page.click('#delRack');
    await page.waitForSelector('#rackGo');
    assert.strictEqual(await page.evaluate(async () => (await window.__rec.loadRacks()).length), 0);
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('continuous rack: closing the page mid-recording keeps what reached storage', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera', 'microphone'], acceptDownloads: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await openRackMode(page, srv.url);
    await page.click('#rackGo');
    await page.waitForSelector('#stopRack:not(.hidden)');
    await page.waitForTimeout(12000);
    await page.goto(srv.url + '/recorder/index.html'); // the page goes away without Stop
    await page.waitForFunction(() => window.__rec);
    await page.click('#resume');
    await page.waitForSelector('[data-open]');
    assert.match(await page.textContent('#panel'), /not saved yet/);
    const rack = await page.evaluate(() => window.__rec.RK.racks[0]);
    assert.strictEqual(rack.state, 'done');
    assert.match(rack.segs[0].end, /page closed/);
    assert.ok(rack.segs[0].bytes > 0 && rack.segs[0].chunks.length >= 2, 'chunks kept: ' + rack.segs[0].chunks.length);
    await page.click('[data-open]');
    await page.waitForSelector('#nextPart');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
