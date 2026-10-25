// Browser test for the recorder's Three-Ball Runout session (recorder/index.html, R0.9): the drill's own instructions,
// one continuous recording, and the New attempt button whose taps go into the recording's events.
// Run: node --test "tests/*.test.js"   (needs Playwright: npm install)
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('./lib/serve.js');

const ROOT = path.join(__dirname, '..');
const ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];

test('three-ball runout: drill instructions, New attempt taps logged as events, nothing asked while recording', async () => {
  const srv = await serve(ROOT);
  const browser = await chromium.launch({ args: ARGS });
  try {
    const ctx = await browser.newContext({ viewport: { width: 956, height: 440 }, permissions: ['camera', 'microphone'] });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/recorder/index.html');
    await page.waitForFunction(() => window.__rec);
    await page.selectOption('#fShort', '5');
    await page.click('#go');
    await page.waitForSelector('#rackGo');
    const txt = await page.textContent('#panel');
    assert.match(txt, /Three-Ball Runout/); assert.match(txt, /the 1, the 2 and the 3/);
    assert.strictEqual(await page.$('#fGame'), null, 'no game to choose');
    await page.click('#rackGo');
    await page.waitForSelector('#stopRack:not(.hidden)');
    assert.ok(await page.isVisible('#newAtt'));
    assert.ok(await page.isHidden('#panel'));
    await page.waitForTimeout(2500);
    await page.click('#newAtt');
    assert.match(await page.textContent('#newAtt'), /Attempt 2/);
    await page.waitForTimeout(1500);
    await page.click('#newAtt');
    await page.waitForTimeout(1500);
    await page.click('#stopRack'); await page.click('#cfYes');
    await page.waitForSelector('#nextPart', { timeout: 15000 });
    assert.ok(await page.isHidden('#newAtt'));
    const rack = await page.evaluate(() => window.__rec.RK.racks[0]);
    assert.strictEqual(rack.game, 'Three-Ball Runout');
    assert.strictEqual(rack.setup.drill, 'threeball');
    const marks = rack.segs[0].events.filter(e => e[2] === 'new-attempt');
    assert.deepStrictEqual(marks.map(e => e[3]), [2, 3]);
    assert.ok(marks[1][0] > marks[0][0] && marks[0][0] > 2000, 'times since the recording started');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
